// Fichas de exemplo, usadas pelos testes e pelas telas de desenvolvimento. Davi Rocha é o
// personagem do protótipo (artboard "Ficha"): Executor e Mecânico, com Máquinas em d10.
import type { FichaOp2 } from '../../schemas/ficha-op2.ts';

export function fichaDoDavi(): FichaOp2 {
  return {
    versao: 1,
    nome: 'Davi Rocha',
    nivel: 2,
    ocupacao: 'Mecânico',
    perfil: 'executor',
    idade: 34,
    origem: 'Santa Ermida',
    atributos: { fisico: 'd8', mente: 'd6', emocao: 'd6' },
    pericias: {
      acrobacia: 'd6',
      atletismo: 'd8',
      crime: 'd8',
      furtividade: 'd6',
      luta: 'd8',
      pontaria: 'd6',
      vigor: 'd6',
      aptidao: 'd4',
      maquinas: 'd10',
      medicina: 'd4',
      ocultismo: 'd4',
      percepcao: 'd6',
      pesquisa: 'd6',
      sobrevivencia: 'd4',
      tecnologia: 'd8',
      disciplina: 'd6',
      enganacao: 'd4',
      intimidacao: 'd6',
      intuicao: 'd6',
      persuasao: 'd6',
    },
    modificadores: [],
    pv: 12,
    pvMax: 12,
    pd: 10,
    pdMax: 12,
    impeto: 1,
    impetoAtributo: null,
    usadasNaCena: [],
    itens: [
      { id: 'kit', nome: 'Kit de ferramentas', descricao: 'Chaves, alicate e fita isolante.' },
      { id: 'lanterna', nome: 'Lanterna', descricao: '' },
      { id: 'radio', nome: 'Rádio de pilha', descricao: 'Pega a frequência da rádio.' },
      { id: 'canivete', nome: 'Canivete', descricao: '' },
    ],
    anotacoes: 'Quem troca as fitas de madrugada?',
    modoDados: 'virtual',
  };
}
