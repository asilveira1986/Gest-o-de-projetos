export type StatusProjeto = 'planejado' | 'em_andamento' | 'pausado' | 'concluido' | 'cancelado'
export type StatusTarefa = 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluida'
export type Prioridade = 'baixa' | 'media' | 'alta'

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: 'admin' | 'colaborador'
  valor_hora: number
  ativo: boolean
}

export interface Cliente {
  id: string
  nome: string
  documento: string | null
  email: string | null
  telefone: string | null
  valor_hora_venda_padrao: number
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}

export interface Projeto {
  id: string
  nome: string
  cliente_id: string | null
  descricao: string | null
  data_inicio: string | null
  prazo: string | null
  orcamento: number
  valor_hora_venda: number | null
  tipo_cobranca: 'hora' | 'fixo'
  valor_fixo: number | null
  status: StatusProjeto
  responsavel_id: string | null
  arquivado: boolean
  clientes?: Cliente | null
}

export interface Tarefa {
  id: string
  projeto_id: string
  titulo: string
  descricao: string | null
  responsavel_id: string | null
  prioridade: Prioridade
  status: StatusTarefa
  prazo: string | null
  horas_estimadas: number
  ordem: number
}

export interface Subtarefa {
  id: string
  tarefa_id: string
  titulo: string
  concluida: boolean
}

export interface Intervalo {
  id: string
  lancamento_id: string
  inicio: string
  fim: string | null
}

export interface LancamentoHoras {
  id: string
  tarefa_id: string
  usuario_id: string
  data: string
  inicio: string | null
  fim: string | null
  horas: number
  descricao: string | null
  valor_hora_aplicado: number
  valor_venda_aplicado: number
  faturavel: boolean
  faturado_em: string | null
  fatura_id: string | null
  origem: 'cronometro' | 'manual'
  estado: 'rodando' | 'pausado' | 'finalizado'
  intervalos_tempo?: Intervalo[]
  tarefas?: Pick<Tarefa, 'id' | 'titulo' | 'projeto_id'> | null
  usuarios?: Pick<Usuario, 'id' | 'nome'> | null
}

export interface Custo {
  id: string
  projeto_id: string
  tarefa_id: string | null
  usuario_id: string | null
  data: string
  descricao: string
  categoria: string
  valor: number
  fornecedor: string | null
  situacao: 'previsto' | 'realizado'
  comprovante_url: string | null
  repassar_cliente: boolean
  faturado_em: string | null
  fatura_id: string | null
  recorrente_id: string | null
}

export interface Comentario {
  id: string
  tarefa_id: string
  usuario_id: string
  texto: string
  data: string
  usuarios?: Pick<Usuario, 'nome'> | null
}

export interface Anexo {
  id: string
  tarefa_id: string
  nome: string
  caminho: string
}

export const STATUS_PROJETO: Record<StatusProjeto, string> = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export const STATUS_TAREFA: Record<StatusTarefa, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  em_revisao: 'Em revisão',
  concluida: 'Concluída',
}

export const PRIORIDADE: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export interface Fatura {
  id: string
  cliente_id: string
  projeto_id: string | null
  descricao: string | null
  emitida_em: string
  vencimento: string
  valor: number
  pago_em: string | null
  valor_pago: number | null
  nfse_status: 'pendente' | 'emitida' | 'dispensada'
  nfse_numero: string | null
  nfse_chave: string | null
  nfse_emitida_em: string | null
  nfse_valor: number | null
  nfse_pdf: string | null
  nfse_xml: string | null
  clientes?: Pick<Cliente, 'nome'> | null
}

export interface CustoRecorrente {
  id: string
  projeto_id: string
  tarefa_id: string | null
  descricao: string
  categoria: string
  valor: number
  fornecedor: string | null
  repassar_cliente: boolean
  frequencia: 'semanal' | 'mensal' | 'anual'
  dia_mes: number | null
  inicio: string
  fim: string | null
  ativo: boolean
  ultima_geracao: string | null
}
