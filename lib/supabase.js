'use client';
import {createClient} from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// A missing key is a deployment mistake, not a runtime condition. Say so loudly
// here rather than letting every query fail with something cryptic.
export const configured = Boolean(url && key);

export const supabase = configured
  ? createClient(url, key, {auth: {persistSession: true, autoRefreshToken: true}})
  : null;
