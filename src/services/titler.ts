// Turns a raw Slack message into a clean ticket: matched client, succinct title, short details.
// Uses Sonnet (fast + cheap); falls back to the old behaviour if ANTHROPIC_API_KEY is unset or
// the call fails, so ticket creation never depends on it.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { supabase } from './supabaseClient';

const MODEL = 'claude-sonnet-5-5';
const CLIENTS_TTL_MS = 10 * 60_000;

export interface ClientRef { client_id: number; client_name: string; domain: string | null; team_assignment: string | null }

let clientsCache: { at: number; rows: ClientRef[] } | null = null;
export async function allClients(): Promise<ClientRef[]> {
  if (clientsCache && Date.now() - clientsCache.at < CLIENTS_TTL_MS) return clientsCache.rows;
  const { data, error } = await supabase.from('clients').select('client_id, client_name, domain, team_assignment').order('client_name');
  if (error) throw error;
  clientsCache = { at: Date.now(), rows: (data ?? []) as ClientRef[] };
  return clientsCache.rows;
}

const Schema = z.object({
  client_id: z.number().int().nullable().describe('client_id from the list if the message clearly refers to that client (by id, name, person, or domain); otherwise null. Never guess.'),
  title: z.string().describe('Succinct summary of the ask, 3–9 words, imperative or noun phrase. No greeting, no @mentions, and never the client\'s or person\'s name or id (added separately).'),
  summary: z.string().describe('1–3 sentences with the specifics a teammate needs: what to do, for what, any URLs, dates or numbers. Plain text, no @mentions. If the message says nothing beyond the title, return an empty string. Never comment on what is missing or unclear.'),
});

const SYSTEM = `You turn a Slack message into a customer-success ticket for FlyDragon (a marketing agency for real-estate clients).
Return the client it is about (only from the provided list, matched by 6-digit client id, client/agent name, or domain), a short title, and a short summary of the details.
Be literal: don't invent facts that are not in the message.`;

export interface CleanTicket { client: ClientRef | null; title: string; summary: string }

let anthropic: Anthropic | null = null;

export async function cleanTicket(text: string, context?: string): Promise<CleanTicket | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropic ??= new Anthropic();
  const clients = await allClients();
  const list = clients.map((c) => `${c.client_id} | ${c.client_name}${c.domain ? ` | ${c.domain}` : ''}`).join('\n');
  try {
    const res = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 600,
      output_config: { effort: 'low', format: betaZodOutputFormat(Schema) },
      system: [
        { type: 'text', text: SYSTEM },
        { type: 'text', text: `Clients (client_id | name | domain):\n${list}`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: `${context ? `${context}\n\n` : ''}Slack message:\n"""\n${text.slice(0, 6000)}\n"""` }],
    });
    const out = res.parsed_output;
    if (!out || res.stop_reason !== 'end_turn') return null;
    return {
      client: clients.find((c) => c.client_id === out.client_id) ?? null,
      title: out.title.trim().replace(/[.\s]+$/, ''),
      summary: out.summary.trim().replace(/[}\s]+$/, ''),
    };
  } catch (err) {
    console.warn('cleanTicket failed; using raw message', err);
    return null;
  }
}

/** "100186 · Briana Winton: Relink content before migration" — client id + name whenever known. */
export const formatTitle = (title: string, client: Pick<ClientRef, 'client_id' | 'client_name'> | null) =>
  (client ? `${client.client_id} · ${client.client_name}: ${title}` : title).slice(0, 150);
