// Supabase/PostgREST vrací max ~1000 řádků na dotaz (nastavení "Max rows").
// Tento helper stránkuje přes .range() a vrátí všechny řádky.
// `builder(from, to)` musí vrátit PostgREST dotaz s aplikovaným .range(from, to).
export async function fetchAllRows<T = unknown>(
  builder: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await builder(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
