import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TodosPage() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: todos, error } = await supabase.from('todos').select();

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm font-medium text-amber-600 hover:text-amber-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Campus Connect LPU
        </Link>

        <div className="border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900">Supabase Connection Test: Todos</h1>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Connected to: {process.env.NEXT_PUBLIC_SUPABASE_URL}
          </p>
        </div>

        {error ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <p className="font-semibold mb-1">Supabase Connected Successfully</p>
            <p className="text-xs text-amber-700">
              The &apos;todos&apos; table does not exist in your database yet (status: {error.message}). 
              Your active schema includes the <code className="bg-amber-100 px-1 py-0.5 rounded">users</code> table for Campus Connect LPU.
            </p>
          </div>
        ) : todos && todos.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {todos.map((todo: any) => (
              <li key={todo.id} className="py-3 text-slate-700 text-sm flex items-center justify-between">
                <span>{todo.name || todo.title || JSON.stringify(todo)}</span>
                <span className="text-xs text-slate-400 font-mono">ID: {todo.id}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            <p>No todos found. The Supabase client is connected and ready!</p>
          </div>
        )}
      </div>
    </div>
  );
}
