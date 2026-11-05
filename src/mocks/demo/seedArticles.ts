/**
 * Conteúdo editorial do modo demo — extraído de backend/seed_test_articles.py
 * (mesmos 12 artigos que o seed local cria), para o demo mostrar o mesmo
 * conteúdo que o time vê em dev. O artigo 1 ganhou um subtítulo (## ) e uma
 * citação (> ) para exibir todas as variações de renderArticleBody.
 *
 * Gerado uma vez; editar à mão é ok (não há gerador a reexecutar).
 */

export interface SeedArticle {
  category_slug: string;
  title: string;
  excerpt: string;
  body: string;
}

export const SEED_ARTICLES: SeedArticle[] = [
  {
    category_slug: 'música',
    title:
      'K-pop como diplomacia: como a Coreia do Sul transformou idols em política externa',
    excerpt:
      'Por trás dos grupos bilionários, uma estratégia de Estado: a Hallyu como vetor de Soft Power planejado desde os anos 1990.',
    body: 'Em 1997, durante a crise asiática, o governo sul-coreano tomou uma decisão que parecia improvável: investir pesado em indústria criativa. Duas décadas depois, BTS encheria estádios em São Paulo, Nova York e Riad.\n\nA Hallyu — onda coreana — não foi acidente. Foi política industrial cultural com KPI claro: aumentar a influência da Coreia do Sul no exterior usando música, cinema e dramas como vitrine.\n\n## A engrenagem por trás dos palcos\n\nO resultado mensurável: em 2024, a exportação cultural do país superou US$ 13 bilhões. Mas o ganho geopolítico é maior — em pesquisa do Soft Power 30, a Coreia subiu da 23ª para a 11ª posição mundial em uma década.\n\n> A Hallyu não foi acidente: foi política industrial com metas, orçamento e prazo.\n\nO modelo coreano interessa a outros países da América Latina, que começam a estudar como replicar o casamento entre Estado e indústria cultural sem cair em propaganda explícita.',
  },
  {
    category_slug: 'música',
    title:
      'Funk brasileiro nas plataformas globais: do baile à geopolítica do streaming',
    excerpt:
      'Anitta no topo do Spotify global expõe a tensão entre potência cultural brasileira e a infraestrutura digital controlada pelo Norte.',
    body: 'Quando "Envolver" chegou ao topo do Spotify global em 2022, a celebração brasileira esconde uma assimetria estrutural: a música é nossa, mas o algoritmo, a plataforma e a parte do leão da receita são deles.\n\nO funk percorreu um caminho parecido com o do reggaeton — sair da periferia, ganhar respaldo institucional via grandes selos, e entrar no circuito global. Mas o controle da distribuição permanece em Estocolmo e Cupertino.\n\nEspecialistas em economia criativa apontam: o desafio brasileiro não é mais criar hits, é construir infraestrutura própria — selos, plataformas, fundos — capaz de capturar valor onde antes só exportávamos talento bruto.\n\nCasos como o do Kondzilla, que migrou de produtor para conglomerado de mídia, mostram que existe espaço. Mas ainda estamos longe de virar o jogo da assimetria.',
  },
  {
    category_slug: 'música',
    title:
      'Reggaeton e o novo mapa cultural: por que a América Latina venceu o pop dos EUA',
    excerpt:
      'Bad Bunny, Karol G e a coalizão de artistas latinos redesenhou o que é considerado pop global em menos de uma década.',
    body: 'Em 2023, Bad Bunny foi o artista mais ouvido do mundo no Spotify pelo terceiro ano consecutivo. Karol G lotou o Estadio Azteca. Rosalía vendeu Madison Square Garden três vezes seguidas. O dado bruto importa, mas o que ele significa importa mais.\n\nPor décadas, "pop global" era sinônimo de pop em inglês. A virada do reggaeton quebrou esse default. Estações de rádio em Lagos tocam Bad Bunny sem tradução. Adolescentes em Tóquio aprendem espanhol pra entender Karol G.\n\nPara analistas de cultura, isso é uma reconfiguração estrutural do Soft Power: a hegemonia cultural dos EUA não está morta, mas perdeu o monopólio da definição do que é desejável.\n\nA questão aberta é se a América Latina vai capitalizar esse momento construindo infraestrutura própria (plataformas, festivais, distribuição) ou se vai ser mais um fornecedor de talento pro circuito anglo.',
  },
  {
    category_slug: 'moda',
    title:
      'Fashion Week e poder brando: o que Milão, Paris e Nova York ainda disputam',
    excerpt:
      'As quatro semanas de moda do hemisfério norte concentram bilhões em prestígio simbólico — e o conflito por essa hegemonia se acirra.',
    body: 'O calendário oficial da moda mundial — Nova York, Londres, Milão, Paris — não é neutro. É o resultado de mais de meio século de disputa institucional, com subsídios governamentais discretos e lobby de federações setoriais.\n\nParis detém o topo simbólico graças à Federation de la Haute Couture, uma entidade que define quais marcas têm direito ao selo "haute couture" — distinção que vale centenas de milhões em valor de marca.\n\nCidades como Seul, Lagos, Cidade do México e São Paulo tentam furar esse cartel há anos. O caminho mais bem-sucedido até hora vem do Oriente: Tóquio, Xangai e Seul construíram calendários paralelos que se conectam ao circuito principal sem submeter-se a ele.\n\nA questão é se esse circuito periférico vai eventualmente substituir o canon das quatro, ou se vai virar apenas mais um anel do mesmo sistema.',
  },
  {
    category_slug: 'moda',
    title: 'Shein, Temu e a guerra invisível da moda rápida chinesa',
    excerpt:
      'O fast fashion chinês não é só preço baixo: é uma operação de dados, logística e algoritmo que coloca em xeque o sistema de moda ocidental.',
    body: 'Em 2024, a Shein gerou mais receita que a Zara e a H&M somadas. O número impressiona, mas o que está por trás é mais relevante: um modelo de produção sob demanda que vira estoques em horas, não em estações.\n\nO segredo não está na manufatura barata — todas as concorrentes já tentaram isso. Está na integração entre algoritmos de tendência (que predizem o próximo viral no TikTok), rede de pequenos fornecedores em Guangzhou e logística aérea direta consumidor-fábrica.\n\nÉ um modelo que reposiciona a China como definidora de moda, não mais como mera fábrica. Marcas brasileiras como C&A, Renner e Riachuelo enfrentam um dilema: copiar o modelo (impossível sem infraestrutura) ou diferenciar-se via narrativa.\n\nA discussão regulatória sobre tarifas, impostos sobre importação direta e auditoria trabalhista vai definir se esse modelo continua escalando ou se será contido.',
  },
  {
    category_slug: 'cinema',
    title:
      'Hollywood em retirada: como a China deixou de ser o salvador das bilheterias',
    excerpt:
      'Por anos, Hollywood ajustou roteiros para agradar Pequim. Em 2026, a relação inverteu: o cinema chinês prescinde dos EUA, e os EUA não recuperam o acesso.',
    body: 'Em 2019, blockbusters como "Doctor Strange" e "Top Gun: Maverick" tinham cenas removidas para agradar a censura chinesa. Mapas eram redesenhados, atores trocados, diálogos reescritos.\n\nHoje, em 2026, o cinema chinês ultrapassou Hollywood em bilheteria doméstica pelo quinto ano consecutivo, e os filmes americanos respondem por menos de 10% do mercado chinês. A pressão de censura virou irrelevância de mercado.\n\nO fenômeno é estrutural: a China construiu sua própria indústria de blockbuster ("Wandering Earth 2", "Creation of the Gods") com escala industrial comparável à de Hollywood, e o público local prefere narrativas locais.\n\nPara os EUA, a perda é dupla: receita direta e Soft Power. Hollywood era o principal instrumento de projeção cultural americana há um século. A pergunta é qual instituição ocupa esse lugar agora — streaming não substitui.',
  },
  {
    category_slug: 'cinema',
    title:
      'Cinema indiano sem fronteiras: o avanço silencioso de Bollywood na cultura global',
    excerpt:
      '"RRR" no Oscar foi sintoma, não causa: a indústria indiana já é a mais produtiva do mundo e começa a fechar acordos de distribuição que ignoram Hollywood.',
    body: 'A Índia produz mais filmes que qualquer outro país do mundo — cerca de 1.800 por ano, em mais de 20 idiomas. Por décadas, isso ficou contido dentro do subcontinente. Agora, não mais.\n\n"RRR", "Pathaan" e "Animal" mostraram que a fórmula Bollywood — musical, ação, drama familiar — escala para audiências fora da diáspora. Plataformas de streaming amplificaram isso: a Netflix India tem mais assinantes que a Netflix Brasil.\n\nMas o jogo mais interessante está nos acordos bilaterais. Tilburg, Riad e Lagos assinaram contratos de coprodução com estúdios indianos que excluem intermediários americanos. É uma quebra de dependência simbólica.\n\nO caso indiano interessa diretamente ao Brasil: somos dois países do Sul global com indústria cultural enorme mas com Soft Power subdimensionado. O que a Índia está aprendendo, vale aprender também.',
  },
  {
    category_slug: 'cinema',
    title:
      'Anime, kawaii e Soft Power: o método japonês de exportar identidade',
    excerpt:
      'O Japão construiu, ao longo de 40 anos, o exemplo mais consistente de Soft Power baseado em pop — sem nunca chamar pelo nome.',
    body: 'Em 1985, Akihito Yoshida, então diretor do Ministério das Relações Exteriores japonês, publicou um relatório interno que ficaria famoso depois: o Japão deveria "deixar a cultura pop falar pelo país". A política não precisava do selo do Estado.\n\nQuarenta anos depois, o resultado fala sozinho: anime, mangá, J-pop, gaming e estética kawaii constroem uma percepção do Japão que nenhum esforço diplomático tradicional alcançaria.\n\nA diferença com o modelo coreano é importante: o Japão deixa a iniciativa privada conduzir, com apoio fiscal silencioso. A Coreia trata cultura como política industrial explícita. Ambos funcionam — mas projetam imagens distintas.\n\nPara a UNESCO, o Japão é hoje o segundo maior exportador cultural do mundo. Mais interessante: é o exemplo mais citado em estudos de Soft Power desde os anos 2000.',
  },
  {
    category_slug: 'literatura',
    title:
      'Booker Prize e a hegemonia anglófona: por que ainda falamos das mesmas vozes',
    excerpt:
      'Em 2026, dos 6 finalistas do Booker, 5 publicam por editoras controladas por dois conglomerados anglo-americanos. A literatura mundial tem cara de quem?',
    body: 'O Booker Prize International, supostamente o prêmio mais cosmopolita da literatura, expõe uma assimetria estrutural: a literatura traduzida que circula globalmente passa quase toda pelo mesmo funil editorial.\n\nDos seis finalistas de 2026, cinco têm suas traduções editadas por selos de Penguin Random House ou HarperCollins. O sexto, da Faber & Faber, está sendo adquirido pela PRH. Em 2030, possivelmente todos.\n\nO resultado é uma literatura mundial que parece diversa em sobrenome mas é monocromática em estrutura: mesmas casas, mesmos agentes literários, mesmos prêmios. Vozes radicalmente diferentes do canon ocidental raramente chegam.\n\nIniciativas como o programa de tradução do Estado coreano (LTI Korea) ou o brasileiro (Fundação Biblioteca Nacional) tentam furar esse bloqueio, mas com orçamentos marginais. A questão é se há espaço pra uma literatura verdadeiramente policêntrica.',
  },
  {
    category_slug: 'literatura',
    title: 'Tradução literária como instrumento de Estado: o caso da Coreia',
    excerpt:
      'O LTI Korea financia traduções de literatura coreana há 25 anos. Hoje, autoras como Han Kang ganham Nobel — e essa não é casualidade.',
    body: 'Em outubro de 2024, Han Kang ganhou o Nobel de Literatura. A festa em Seul foi imediata — e antiga. Han Kang foi traduzida ao inglês em 2015 pela Deborah Smith, tradutora financiada pelo Literature Translation Institute of Korea (LTI).\n\nO LTI Korea, fundado em 2001, é uma agência estatal com missão única: levar literatura coreana ao mundo. Financia traduções, residências de tradutores, prêmios, festivais. Orçamento anual: ~US$ 50 milhões.\n\nResultados mensuráveis em 25 anos: a literatura coreana traduzida cresceu 30× em volume; o número de obras coreanas em listas de bestsellers internacionais passou de 0 para 12 simultâneos; e o Nobel veio.\n\nBrasil tem um equivalente embrionário (Programa de Apoio à Tradução da BN), com orçamento ~50× menor que o coreano. A pergunta política: vale a pena escalar?',
  },
  {
    category_slug: 'cultura-digital',
    title: 'TikTok, ByteDance e a nova diplomacia algorítmica',
    excerpt:
      'O TikTok foi proibido em quatro países em 2026. Mas o debate sobre algoritmo como instrumento geopolítico ainda está engatinhando.',
    body: 'Em janeiro de 2026, o Reino Unido se juntou aos EUA, Índia e Indonésia na proibição do TikTok em dispositivos governamentais. A justificativa oficial: segurança nacional. A questão por trás: quem controla o algoritmo, controla o que é visto.\n\nA ByteDance, dona do TikTok, opera sob jurisdição chinesa — o que significa que, tecnicamente, o governo chinês pode requisitar dados ou influenciar pesos do algoritmo. Não há evidência pública de que isso tenha acontecido, mas a possibilidade é estrutural.\n\nO debate jurídico nos EUA culminou na lei que força a ByteDance a vender o TikTok americano até 2027, sob pena de banimento. A Suprema Corte sustentou a lei em 2025.\n\nPara o Brasil, a discussão é mais sutil: temos infraestrutura de mídia social 100% controlada por empresas estrangeiras (Meta, X, ByteDance, Google). Que tipo de Soft Power exercemos quando nem o canal é nosso?',
  },
  {
    category_slug: 'cultura-digital',
    title: 'Wikipedia, edição cultural e a batalha pela memória global',
    excerpt:
      'A enciclopédia mais consultada do mundo é editada por uma minoria homogênea. As consequências para a representação cultural são mensuráveis — e graves.',
    body: 'Pesquisas recentes mostram que 87% dos editores ativos da Wikipedia em inglês são homens, 80% são do Norte global, e a maioria absoluta tem ensino superior em ciências exatas. O resultado: um viés sistemático no que é considerado relevante.\n\nArtigos sobre figuras femininas têm em média 30% menos extensão que sobre figuras masculinas equivalentes. Personalidades do Sul global recebem 40% menos citações que europeias equivalentes. Eventos históricos não-ocidentais são subdocumentados.\n\nPara uma plataforma que é a primeira parada de qualquer busca por conhecimento — e que alimenta IA generativa, assistentes de voz e algoritmos de recomendação — esse viés se amplifica em cascata pela web inteira.\n\nMovimentos como Whose Knowledge?, AfroCROWD e Art+Feminism trabalham para fechar a lacuna. Mas o desafio é arquitetural: a Wikipedia foi construída assumindo neutralidade onde nunca houve.',
  },
];
