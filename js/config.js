'use strict';
// ============================================================
// CONFIG — clés API, client Supabase, constantes globales
// ============================================================

const SUPABASE_URL = 'https://vjhegncviufyguzdrpdp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hLYKWsVftWedOIbDinl0mQ_9uGREGsw';

const TMDB_API_KEY = '583ca520c77c1c660d94610a7daf531c';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const localUserId = 'tvr_master_user_2026';

const PAGE_SIZE = 30;
const seasonColors = ['bg-teal-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-teal-400', 'bg-cyan-400', 'bg-emerald-400', 'bg-teal-600', 'bg-cyan-600'];
