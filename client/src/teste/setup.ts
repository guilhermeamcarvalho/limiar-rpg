// Roda antes de cada arquivo de teste do client.
import { configure } from '@testing-library/react';

// As páginas são carregadas sob demanda (lazy): na primeira vez, importar o módulo pode levar
// mais de 1 s numa máquina lenta. As esperas (findBy, waitFor) ganham folga para isso.
configure({ asyncUtilTimeout: 5000 });

// O jsdom não implementa rolagem; os navegadores, sim.
Element.prototype.scrollIntoView = () => undefined;
