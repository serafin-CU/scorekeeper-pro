import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const QUESTIONS = [
  // Day 1 — May 27, 2026 — Pre-Kickoff — Welcome to UnityCup — EASY — HOST_2026 — is_active: true
  {
    question_text: "How many host countries will the 2026 FIFA World Cup have for the first time in history?",
    options: ["One", "Two", "Three", "Four"],
    correct_answer_index: 2,
    category: "HOST_2026",
    difficulty: "EASY",
    is_active: true,
    source_note: "Day 1 — May 27, 2026 — 2026 is the first World Cup hosted by three nations: USA, Canada, and Mexico.",
    times_used: 0
  },
  {
    question_text: "How many teams will compete in the 2026 World Cup, the largest field ever?",
    options: ["32", "40", "48", "64"],
    correct_answer_index: 2,
    category: "HOST_2026",
    difficulty: "EASY",
    is_active: true,
    source_note: "Day 1 — May 27, 2026 — FIFA expanded the tournament to 48 teams for 2026.",
    times_used: 0
  },
  {
    question_text: "On what date does the 2026 World Cup officially kick off?",
    options: ["June 8, 2026", "June 11, 2026", "June 18, 2026", "July 1, 2026"],
    correct_answer_index: 1,
    category: "HOST_2026",
    difficulty: "EASY",
    is_active: true,
    source_note: "Day 1 — May 27, 2026 — The opening match is scheduled for June 11, 2026 at Estadio Azteca, Mexico City.",
    times_used: 0
  },
  {
    question_text: "Which city will host the 2026 World Cup Final?",
    options: ["Los Angeles", "Mexico City", "East Rutherford (NY/NJ)", "Toronto"],
    correct_answer_index: 2,
    category: "HOST_2026",
    difficulty: "EASY",
    is_active: true,
    source_note: "Day 1 — May 27, 2026 — The Final is scheduled for MetLife Stadium in East Rutherford, NJ on July 19, 2026.",
    times_used: 0
  },
  {
    question_text: "How many total matches will be played in the expanded 2026 tournament?",
    options: ["64", "80", "104", "128"],
    correct_answer_index: 2,
    category: "HOST_2026",
    difficulty: "EASY",
    is_active: true,
    source_note: "Day 1 — May 27, 2026 — The 48-team format produces 104 matches, up from 64 in previous editions.",
    times_used: 0
  },

  // Day 2 — May 28, 2026 — World Cup 101 — EASY — KNOCKOUT_HISTORY — is_active: false
  {
    question_text: "In what year was the very first FIFA World Cup held?",
    options: ["1928", "1930", "1934", "1938"],
    correct_answer_index: 1,
    category: "KNOCKOUT_HISTORY",
    difficulty: "EASY",
    is_active: false,
    source_note: "Day 2 — May 28, 2026 — The first World Cup was held in Uruguay in 1930.",
    times_used: 0
  },
  {
    question_text: "Which country won the first ever World Cup in 1930?",
    options: ["Argentina", "Brazil", "Uruguay", "Italy"],
    correct_answer_index: 2,
    category: "KNOCKOUT_HISTORY",
    difficulty: "EASY",
    is_active: false,
    source_note: "Day 2 — May 28, 2026 — Host nation Uruguay defeated Argentina 4-2 in the first Final.",
    times_used: 0
  },
  {
    question_text: "Which nation has won the most World Cups in history (as of 2022)?",
    options: ["Germany", "Argentina", "Italy", "Brazil"],
    correct_answer_index: 3,
    category: "KNOCKOUT_HISTORY",
    difficulty: "EASY",
    is_active: false,
    source_note: "Day 2 — May 28, 2026 — Brazil has 5 titles (1958, 1962, 1970, 1994, 2002).",
    times_used: 0
  },
  {
    question_text: "How often is the FIFA World Cup held?",
    options: ["Every 2 years", "Every 3 years", "Every 4 years", "Every 5 years"],
    correct_answer_index: 2,
    category: "KNOCKOUT_HISTORY",
    difficulty: "EASY",
    is_active: false,
    source_note: "Day 2 — May 28, 2026 — The World Cup has been held every four years since 1930, with exceptions in 1942 and 1946 due to WWII.",
    times_used: 0
  },
  {
    question_text: "Who won the most recent World Cup in Qatar 2022?",
    options: ["France", "Argentina", "Brazil", "Croatia"],
    correct_answer_index: 1,
    category: "KNOCKOUT_HISTORY",
    difficulty: "EASY",
    is_active: false,
    source_note: "Day 2 — May 28, 2026 — Argentina beat France on penalties after a 3-3 draw, with Messi lifting his first World Cup.",
    times_used: 0
  },

  // Day 3 — May 29, 2026 — Canada Hosts — MEDIUM — HOST_2026 — is_active: false
  {
    question_text: "How many Canadian cities will host 2026 World Cup matches?",
    options: ["1", "2", "3", "4"],
    correct_answer_index: 1,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 3 — May 29, 2026 — Toronto and Vancouver are the two Canadian host cities.",
    times_used: 0
  },
  {
    question_text: "Which Toronto stadium will host World Cup matches in 2026?",
    options: ["Rogers Centre", "Scotiabank Arena", "BMO Field", "Exhibition Stadium"],
    correct_answer_index: 2,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 3 — May 29, 2026 — BMO Field is being expanded to host 2026 matches.",
    times_used: 0
  },
  {
    question_text: "Which Vancouver venue will host World Cup matches?",
    options: ["Rogers Arena", "BC Place", "Empire Field", "PNE Coliseum"],
    correct_answer_index: 1,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 3 — May 29, 2026 — BC Place is the Vancouver host venue.",
    times_used: 0
  },
  {
    question_text: "When did Canada's men's national team make its FIRST ever World Cup appearance?",
    options: ["1986", "1994", "2002", "2022"],
    correct_answer_index: 0,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 3 — May 29, 2026 — Canada debuted at Mexico 1986 — their only WC appearance before qualifying again for 2022.",
    times_used: 0
  },
  {
    question_text: "Canada automatically qualifies for 2026 because they are…",
    options: ["Defending champions", "A host nation", "CONCACAF winners", "Wildcard pick"],
    correct_answer_index: 1,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 3 — May 29, 2026 — All three host nations (Canada, Mexico, USA) qualify automatically.",
    times_used: 0
  },

  // Day 4 — May 30, 2026 — Canadian Food + CookUnity — MEDIUM — CULTURE_AND_FOOD — is_active: false
  {
    question_text: "Which CookUnity chef runs Alo, a Toronto restaurant with two Michelin stars?",
    options: ["Rocco Agostino", "Patrick Kriss", "Rick Bayless", "Marcus Samuelsson"],
    correct_answer_index: 1,
    category: "CULTURE_AND_FOOD",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 4 — May 30, 2026 — Patrick Kriss is the chef behind Alo in Toronto, awarded 2 Michelin stars.",
    times_used: 0
  },
  {
    question_text: "Poutine — fries, cheese curds, gravy — originated in which Canadian province?",
    options: ["Ontario", "British Columbia", "Quebec", "Alberta"],
    correct_answer_index: 2,
    category: "CULTURE_AND_FOOD",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 4 — May 30, 2026 — Poutine is a Quebec dish dating to the late 1950s.",
    times_used: 0
  },
  {
    question_text: "Which CookUnity chef is associated with Italian cooking and Toronto's food scene?",
    options: ["Patrick Kriss", "Rocco Agostino", "Cat Cora", "Pierre Thiam"],
    correct_answer_index: 1,
    category: "CULTURE_AND_FOOD",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 4 — May 30, 2026 — Rocco Agostino is a Toronto-based Italian chef on the CookUnity roster.",
    times_used: 0
  },
  {
    question_text: "Butter tarts, a Canadian classic, are most similar in style to which American dessert?",
    options: ["Apple pie", "Pecan pie", "Cheesecake", "Brownie"],
    correct_answer_index: 1,
    category: "CULTURE_AND_FOOD",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 4 — May 30, 2026 — Butter tarts share the gooey filling style of pecan pie, minus the pecans.",
    times_used: 0
  },
  {
    question_text: "Which Canadian city is the CookUnity Toronto market based around?",
    options: ["Montreal", "Vancouver", "Toronto", "Calgary"],
    correct_answer_index: 2,
    category: "CULTURE_AND_FOOD",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 4 — May 30, 2026 — CookUnity's Canadian market is centered in the Greater Toronto Area.",
    times_used: 0
  },

  // Day 5 — May 31, 2026 — Mexico Hosts — MEDIUM — HOST_2026 — is_active: false
  {
    question_text: "Which iconic stadium will host the 2026 World Cup opening match?",
    options: ["Estadio Akron", "Estadio BBVA", "Estadio Azteca", "Estadio Olímpico"],
    correct_answer_index: 2,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 5 — May 31, 2026 — Estadio Azteca in Mexico City hosts the opener — its THIRD World Cup (1970, 1986, 2026).",
    times_used: 0
  },
  {
    question_text: "Estadio Azteca becomes the first stadium ever to host matches in how many different World Cups?",
    options: ["Two", "Three", "Four", "Five"],
    correct_answer_index: 1,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 5 — May 31, 2026 — Azteca hosted in 1970, 1986, and now 2026 — a unique record.",
    times_used: 0
  },
  {
    question_text: "How many Mexican cities will host 2026 World Cup matches?",
    options: ["2", "3", "4", "5"],
    correct_answer_index: 1,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 5 — May 31, 2026 — Mexico City, Guadalajara, and Monterrey are the three Mexican host cities.",
    times_used: 0
  },
  {
    question_text: "In which Guadalajara stadium will 2026 matches be played?",
    options: ["Estadio Jalisco", "Estadio Akron", "Estadio 3 de Marzo", "Estadio Tecnológico"],
    correct_answer_index: 1,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 5 — May 31, 2026 — Estadio Akron (also known as Estadio Chivas) is the Guadalajara host venue.",
    times_used: 0
  },
  {
    question_text: "Mexico has hosted the World Cup how many times before 2026?",
    options: ["Never", "Once", "Twice", "Three times"],
    correct_answer_index: 2,
    category: "HOST_2026",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Day 5 — May 31, 2026 — Mexico hosted in 1970 and 1986 — 2026 will be their third time.",
    times_used: 0
  },
  // Day 6 — June 1, 2026 — World Cup Legends — MEDIUM — LEGENDS
  {
    question_text: "Which player has scored the most goals in FIFA World Cup history?",
    options: ["Miroslav Klose", "Ronaldo", "Pelé", "Lionel Messi"],
    correct_answer_index: 0,
    category: "LEGENDS",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Miroslav Klose scored 16 World Cup goals for Germany between 2002 and 2014.",
    times_used: 0
  },
  {
    question_text: "Which player is known as 'The King of Football' and won three World Cups?",
    options: ["Diego Maradona", "Pelé", "Johan Cruyff", "Zinedine Zidane"],
    correct_answer_index: 1,
    category: "LEGENDS",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Pelé won World Cups in 1958, 1962, and 1970.",
    times_used: 0
  },
  {
    question_text: "Which country did Diego Maradona represent?",
    options: ["Brazil", "Spain", "Argentina", "Uruguay"],
    correct_answer_index: 2,
    category: "LEGENDS",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Maradona captained Argentina to the 1986 World Cup title.",
    times_used: 0
  },
  {
    question_text: "Who won the Golden Ball as the best player of the 2022 World Cup?",
    options: ["Kylian Mbappé", "Lionel Messi", "Luka Modrić", "Julián Álvarez"],
    correct_answer_index: 1,
    category: "LEGENDS",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Messi led Argentina to the 2022 World Cup title.",
    times_used: 0
  },
  {
    question_text: "Which French player scored a hat trick in the 2022 World Cup Final?",
    options: ["Antoine Griezmann", "Olivier Giroud", "Kylian Mbappé", "Kingsley Coman"],
    correct_answer_index: 2,
    category: "LEGENDS",
    difficulty: "MEDIUM",
    is_active: false,
    source_note: "Mbappé scored three goals against Argentina in the Final.",
    times_used: 0
  },

  // Day 7 — June 2, 2026 — World Cup Records — HARD — RECORDS
  {
    question_text: "Which country has appeared in every FIFA World Cup tournament?",
    options: ["Germany", "Argentina", "Brazil", "Italy"],
    correct_answer_index: 2,
    category: "RECORDS",
    difficulty: "HARD",
    is_active: false,
    source_note: "Brazil is the only nation to qualify for every World Cup.",
    times_used: 0
  },
  {
    question_text: "What is the largest margin of victory in a World Cup match?",
    options: ["8 goals", "9 goals", "10 goals", "11 goals"],
    correct_answer_index: 1,
    category: "RECORDS",
    difficulty: "HARD",
    is_active: false,
    source_note: "Hungary defeated El Salvador 10-1 in 1982.",
    times_used: 0
  },
  {
    question_text: "Which country won the 2010 FIFA World Cup?",
    options: ["Netherlands", "Spain", "Germany", "Brazil"],
    correct_answer_index: 1,
    category: "RECORDS",
    difficulty: "HARD",
    is_active: false,
    source_note: "Spain beat the Netherlands 1-0 after extra time.",
    times_used: 0
  },
  {
    question_text: "Which goalkeeper holds the record for the most World Cup clean sheets?",
    options: ["Gianluigi Buffon", "Manuel Neuer", "Peter Shilton", "Fabien Barthez"],
    correct_answer_index: 2,
    category: "RECORDS",
    difficulty: "HARD",
    is_active: false,
    source_note: "England's Peter Shilton recorded 10 clean sheets.",
    times_used: 0
  },
  {
    question_text: "Which country won the first World Cup held in Asia?",
    options: ["Germany", "Brazil", "France", "Italy"],
    correct_answer_index: 1,
    category: "RECORDS",
    difficulty: "HARD",
    is_active: false,
    source_note: "Brazil won the 2002 tournament hosted by South Korea and Japan.",
    times_used: 0
  },

  // Day 8 — June 3, 2026 — World Cup Finals — EASY — FINALS
  {
    question_text: "Which country defeated Germany in the 2014 World Cup Final?",
    options: ["Argentina", "Brazil", "Spain", "None of the above"],
    correct_answer_index: 3,
    category: "FINALS",
    difficulty: "EASY",
    is_active: false,
    source_note: "Germany defeated Argentina 1-0 to win the 2014 World Cup.",
    times_used: 0
  },
  {
    question_text: "Which nation won the 2018 FIFA World Cup?",
    options: ["France", "Croatia", "Belgium", "England"],
    correct_answer_index: 0,
    category: "FINALS",
    difficulty: "EASY",
    is_active: false,
    source_note: "France beat Croatia 4-2 in Moscow.",
    times_used: 0
  },
  {
    question_text: "Which country lost to Argentina in the 2022 World Cup Final?",
    options: ["Croatia", "Brazil", "France", "Morocco"],
    correct_answer_index: 2,
    category: "FINALS",
    difficulty: "EASY",
    is_active: false,
    source_note: "Argentina defeated France on penalties after a 3-3 draw.",
    times_used: 0
  },
  {
    question_text: "Who scored the winning goal in the 2014 World Cup Final?",
    options: ["Thomas Müller", "Mario Götze", "Miroslav Klose", "Mesut Özil"],
    correct_answer_index: 1,
    category: "FINALS",
    difficulty: "EASY",
    is_active: false,
    source_note: "Mario Götze scored in extra time against Argentina.",
    times_used: 0
  },
  {
    question_text: "Which nation won the 1998 World Cup on home soil?",
    options: ["Brazil", "France", "Italy", "Germany"],
    correct_answer_index: 1,
    category: "FINALS",
    difficulty: "EASY",
    is_active: false,
    source_note: "France defeated Brazil 3-0 in Paris.",
    times_used: 0
  },

  // Day 9 — June 4, 2026 — Fun Facts — EASY — WORLD_CUP_FUN
  {
    question_text: "What animal appeared as the mascot of the 1966 World Cup in England?",
    options: ["Bear", "Lion", "Tiger", "Dog"],
    correct_answer_index: 1,
    category: "WORLD_CUP_FUN",
    difficulty: "EASY",
    is_active: false,
    source_note: "World Cup Willie, a lion, was the first official mascot.",
    times_used: 0
  },
  {
    question_text: "Which country hosted the 2014 FIFA World Cup?",
    options: ["Argentina", "Brazil", "Chile", "Mexico"],
    correct_answer_index: 1,
    category: "WORLD_CUP_FUN",
    difficulty: "EASY",
    is_active: false,
    source_note: "Brazil hosted the tournament in 2014.",
    times_used: 0
  },
  {
    question_text: "What color is traditionally associated with Brazil's national team jersey?",
    options: ["Blue", "Green", "Yellow", "White"],
    correct_answer_index: 2,
    category: "WORLD_CUP_FUN",
    difficulty: "EASY",
    is_active: false,
    source_note: "Brazil's iconic jersey is yellow with green trim.",
    times_used: 0
  },
  {
    question_text: "Which country famously defeated Brazil 7-1 in the 2014 semifinal?",
    options: ["Argentina", "France", "Germany", "Spain"],
    correct_answer_index: 2,
    category: "WORLD_CUP_FUN",
    difficulty: "EASY",
    is_active: false,
    source_note: "Germany's 7-1 win is one of the most famous matches in World Cup history.",
    times_used: 0
  },
  {
    question_text: "How many stars appear above Brazil's crest to represent its World Cup titles?",
    options: ["Three", "Four", "Five", "Six"],
    correct_answer_index: 2,
    category: "WORLD_CUP_FUN",
    difficulty: "EASY",
    is_active: false,
    source_note: "Brazil displays five stars for its five World Cup victories.",
    times_used: 0
  }
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  let ok = 0;
  let fail = 0;
  const errors = [];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    try {
      await base44.asServiceRole.entities.TriviaQuestion.create(q);
      ok++;
    } catch (err) {
      fail++;
      errors.push({ index: i, question: q.question_text.slice(0, 60), error: err.message });
    }
  }

  console.log(JSON.stringify({ ok, fail, errors }));

  // Verification: total count + Day 1 (is_active=true) count
  const allQuestions = await base44.asServiceRole.entities.TriviaQuestion.list();
  const totalCount = allQuestions.length;
  const day1Count = allQuestions.filter(q => q.is_active === true).length;

  console.log(JSON.stringify({ totalCount, day1ActiveCount: day1Count, note: "day1ActiveCount = is_active:true rows" }));

  return Response.json({ ok, fail, errors, totalCount, day1ActiveCount: day1Count });
});