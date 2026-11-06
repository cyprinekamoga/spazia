"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { fetchConversations, fetchMessages, markRead, type ConversationSummary } from "@/lib/app/data";
import { effectiveStatus, formatPeriod, type Message, type RequestRow } from "@/lib/app/model";
import { must, useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useHostSession } from "../HostShell";
import { Avatar, itemsText } from "./RequestCard";

const t = appText.messages;

function eventText(body: string, renterName: string): string {
  const key = body as keyof typeof appText.events;
  return appText.events[key] ? fill(appText.events[key], { name: renterName }) : body;
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

function Inbox({ uid }: { uid: string }) {
  const { data, loading } = useLoad(() => fetchConversations(uid), uid);
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
            const name = c.renter?.first_name || "–";
            const unread = isUnread(c, uid);
            return (
              <li key={c.id}>
                <Link prefetch={false} href={`/vard/meddelanden?id=${c.id}`} className="flex items-start gap-3 p-4 hover:bg-frost/50">
                  <Avatar name={name} url={c.renter?.avatar_url} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`${unread ? "font-bold" : "font-semibold"} text-night`}>{name}</span>
                      <span className="shrink-0 text-xs text-muted">{last ? timeLabel(last.created_at) : ""}</span>
                    </span>
                    <span className="block truncate text-sm text-muted">{c.listing?.title}</span>
                    {last && (
                      <span className={`block truncate text-[0.95rem] ${unread ? "font-semibold text-night" : "text-ink/80"}`}>
                        {last.kind === "event" ? eventText(last.body, name) : last.body}
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
  conversation: { id: string; listing: { id: string; title: string } | null; renter: { first_name: string; avatar_url: string | null } | null };
  requests: RequestRow[];
};

function ThreadView({ id, uid }: { id: string; uid: string }) {
  const head = useLoad(async (): Promise<Thread> => {
    const db = supabase();
    const conversation = must(
      await db.from("conversations").select("id, listing:listings(id, title), renter:profiles!conversations_renter_id_fkey(first_name, avatar_url)").eq("id", id).single(),
    ) as unknown as Thread["conversation"];
    const requests = must(await db.from("requests").select("*, request_items(category, quantity, host_price_month)").eq("conversation_id", id).order("created_at", { ascending: false })) as RequestRow[];
    return { conversation, requests };
  }, id);
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

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
  const name = head.data.conversation.renter?.first_name || "–";

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <Link prefetch={false} href="/vard/meddelanden" className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night">
        <ArrowLeft size={18} aria-hidden="true" />
        {t.back}
      </Link>
      <div className="mt-2 flex items-center gap-3 border-b border-line pb-4">
        <Avatar name={name} url={head.data.conversation.renter?.avatar_url} />
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight text-night">{name}</h1>
          <p className="truncate text-sm text-muted">{fill(t.about, { listing: head.data.conversation.listing?.title ?? "" })}</p>
        </div>
      </div>

      {head.data.requests.slice(0, 1).map((r) => (
        <Link key={r.id} prefetch={false} href={`/vard/forfragan?id=${r.id}`} className="mt-4 card block p-4 hover:border-night/30">
          <span className="block text-sm font-semibold text-muted">{appText.requestStatus[effectiveStatus(r, now)]}</span>
          <span className="block font-semibold text-night">{itemsText(r.request_items)}</span>
          <span className="block text-sm text-muted">{formatPeriod(r.start_date, r.end_date, appText.common.untilFurtherNotice)}</span>
        </Link>
      ))}

      <ol className="mt-5 space-y-3">
        {messages.map((m) =>
          m.kind === "event" ? (
            <li key={m.id} className="py-1 text-center text-sm font-semibold text-muted">
              {eventText(m.body, name)}
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
      <div ref={endRef} />

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

export function MessagesPage() {
  const uid = useHostSession().user.id;
  const id = useSearchParams().get("id");
  return id ? <ThreadView key={id} id={id} uid={uid} /> : <Inbox uid={uid} />;
}
