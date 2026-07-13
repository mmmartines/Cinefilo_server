import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('As variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY devem estar definidas.');
}

// Inicializa o cliente do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Utilitário para validar o token JWT vindo do cabeçalho da requisição
 */
export async function authenticateUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Cabeçalho Authorization ausente');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Token inválido ou expirado');
  }

  return user;
}
