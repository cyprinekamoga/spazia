"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { fetchConversations, fetchMessages, markRead, otherProfile, type ConversationSummary } from "@/lib/app/data";
import { effectiveStatus, periodText, type AppMode, type Message, type RequestRow } from "@/lib/app/model";
import { MODE_HOME } from "@/lib/app/mode";
import { must, useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useAppSession } from "./AppShell";
import { Avatar, itemsText } from "./ui";

const t = appText.messages;

/** "Anna skickade en förfrågan", or "Du skickade en förfrågan" when it was you. */
function eventText(body: string, senderName: string, mine: boolean): string {
  const key = body as keyof typeof appText.events;
  if (mine && appText.eventsSelf[key]) return appText.eventsSelf[key];
  return appText.events[key] ? fill(appText.events[key], { name: senderName }) : body;
}

/** Where a request in a thread opens: the host's or the renter's page for it. */
function requestHref(mode: AppMode, id: string): string {
  return mode === "host" ? `/vard/forfragan?id=${id}` : `/kund/bokning?id=${id}`;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("sv-SE", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }).format(d);
}

function isUnread(c: ConversationSummary, uid: string): boolean {
  const last = c.messages[0];
  if (!last || last.sender_id === uid) return false;
  const read = c.conversation_reads.find((r) => r.user_id === uid);
  return !read || read.last_read_at < last.created_at;
}

function Inbox({ uid, mode }: { uid: string; mode: AppMode }) {
  const { data, loading } = useLoad(() => fetchConversations(uid, mode), `${uid}:${mode}`);
  if (loading) return <Spinner />;
  const list = data ?? [];
  return (
    <div>
      <h1 className="text-[2rem] leading-tight text-night">{t.title}</h1>
      {list.length === 0 ? (
        <p className="mt-3 text-muted">{t.empty}</p>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-paper">
          {list.map((c) => {
            const last = c.messages[0];
            const name = c.other?.first_name || "–";
            const unread = isUnread(c, uid);
            return (
              <li key={c.id}>
                <Link prefetch={false} href={`${MODE_HOME[mode]}/meddelanden?id=${c.id}`} className="flex items-start gap-3 p-4 hover:bg-frost/50">
                  <Avatar name={name} url={c.other?.avatar_url} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`${unread ? "font-bold" : "font-semibold"} text-night`}>{name}</span>
                      <span className="shrink-0 text-xs text-muted">{last ? timeLabel(last.created_at) : ""}</span>
                    </span>
                    <span className="block truncate text-sm text-muted">{c.listing?.title}</span>
                    {last && (
                      <span className={`block truncate text-[0.95rem] ${unread ? "font-semibold text-night" : "text-ink/80"}`}>
                        {last.kind === "event" ? eventText(last.body, name, last.sender_id === uid) : last.body}
                      </span>
                    )}
                  </span>
                  {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Oläst" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Thread = {
  conversation: { id: string; listing: { id: string; title: string } | null; other: { first_name: string; avatar_url: string | null } | null };
  requests: RequestRow[];
};

function ThreadView({ id, uid, mode }: { id: string; uid: string; mode: AppMode }) {
  const head = useLoad(async (): Promise<Thread> => {
    const db = supabase();
    const conversation = must(
      await db.from("conversations").select(`id, listing:listings(id, title), ${otherProfile(mode)}(first_name, avatar_url)`).eq("id", id).single(),
    ) as unknown as Thread["conversation"];
    const requests = must(await db.from("requests").select("*, request_items(category, quantity, host_price_month, hourly_price, daily_max)").eq("conversation_id", id).order("created_at", { ascending: false })) as RequestRow[];
    return { conversation, requests };
  }, `${id}:${mode}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [now] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  // Load messages, then check for new ones every 10 seconds while the thread is open.
  useEffect(() => {
    let active = true;
    const load = async () => {
      const list = await fetchMessages(id);
      if (!active) return;
      setMessages((prev) => (prev.length === list.length ? prev : list));
      await markRead(id, uid);
    };
    void load();
    const timer = setInterval(load, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, uid]);

  // Scroll to the newest message once the thread is on screen, and after each new one.
  useEffect(() => {
    if (!head.loading) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, head.loading]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const res = await supabase().from("messages").insert({ conversation_id: id, sender_id: uid, body }).select("*").single();
    setSending(false);
    if (!res.error) {
      setText("");
      setMessages((m) => [...m, res.data as Message]);
    }
  }

  if (head.loading) return <Spinner />;
  if (!head.data) return <p className="text-muted">{appText.common.error}</p>;
  const name = head.data.conversation.other?.first_name || "–";

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <Link prefetch={false} href={`${MODE_HOME[mode]}/meddelanden`} className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night">
        <ArrowLeft size={18} aria-hidden="true" />
        {t.back}
      </Link>
      <div className="mt-2 flex items-center gap-3 border-b border-line pb-4">
        <Avatar name={name} url={head.data.conversation.other?.avatar_url} />
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight text-night">{name}</h1>
          <p className="truncate text-sm text-muted">{fill(t.about, { listing: head.data.conversation.listing?.title ?? "" })}</p>
        </div>
      </div>

      {head.data.requests.slice(0, 1).map((r) => (
        <Link key={r.id} prefetch={false} href={requestHref(mode, r.id)} className="mt-4 card block p-4 hover:border-night/30">
          <span className="block text-sm font-semibold text-muted">{appText.requestStatus[effectiveStatus(r, now)]}</span>
          <span className="block font-semibold text-night">{itemsText(r.request_items)}</span>
          <span className="block text-sm text-muted">{periodText(r, appText.common.untilFurtherNotice)}</span>
        </Link>
      ))}

      <ol className="mt-5 space-y-3">
        {messages.map((m) =>
          m.kind === "event" ? (
            <li key={m.id} className="py-1 text-center text-sm font-semibold text-muted">
              {eventText(m.body, name, m.sender_id === uid)}
              <span className="ml-1 font-normal">{timeLabel(m.created_at)}</span>
            </li>
          ) : (
            <li key={m.id} className={`flex ${m.sender_id === uid ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.sender_id === uid ? "rounded-br-md bg-night text-white" : "rounded-bl-md border border-line bg-paper text-ink"}`}>
                <p className="leading-relaxed whitespace-pre-line">{m.body}</p>
                <p className={`mt-1 text-right text-xs ${m.sender_id === uid ? "text-frost-2" : "text-muted"}`}>{timeLabel(m.created_at)}</p>
              </div>
            </li>
          ),
        )}
      </ol>
      {/* Keep the newest message clear of the message box and the tab bar when scrolled into view. */}
      <div ref={endRef} className="scroll-mb-44 md:scroll-mb-24" />

      <form onSubmit={send} className="sticky bottom-20 mt-5 flex items-end gap-2 rounded-2xl border border-line bg-paper p-2 md:bottom-4">
        <label htmlFor="message" className="sr-only">
          {t.placeholder}
        </label>
        <textarea
          id="message"
          rows={1}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 focus:outline-none"
        />
        <button type="submit" disabled={sending || !text.trim()} aria-label={t.send} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-40">
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

export function MessagesPage({ mode }: { mode: AppMode }) {
  const uid = useAppSession().user.id;
  const id = useSearchParams().get("id");
  return id ? <ThreadView key={id} id={id} uid={uid} mode={mode} /> : <Inbox uid={uid} mode={mode} />;
}
