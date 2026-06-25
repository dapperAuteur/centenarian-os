#!/usr/bin/env node
// scripts/generate-bvc-episode-csv.mjs <episode-slug>
//
// Generalized BVC importer-CSV generator. Reads the source-of-truth lessons +
// JSON assets under plans/BVC/ver1/<slug>/ and writes an import-ready 16-column
// CSV to public/templates/. Tracked record + teacher-UI reimport path; the
// authoritative live import is scripts/bvc-academy-load.mjs (which also preserves
// the recorded audio lesson and loads glossary, maps, and the assignment).
//
// Run: node scripts/generate-bvc-episode-csv.mjs coffee|tea

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = '/Users/bam/Code_NOiCloud/ai-builds/gemini/centenarian-os';
// Per episode: number, module title/order, and lesson spec mirroring bvc-academy-load.mjs.
const EPISODES = {
  coffee: {
    ep: 1, moduleTitle: 'Episode 1: Coffee — The Daily Global Connection', moduleOrder: 1,
    lessons: [
      [2, '02-intro.md', 'Coffee, and Why a Cup Is a Classroom', 'text', 180, 'true', null, ['teacher-resources']],
      [3, '03-geo-coffee-belt.md', 'The Coffee Belt: Where Coffee Grows and Why', 'text', 360, 'true', null, []],
      [4, '04-geo-producers.md', 'The Big Producers and Their Terroir', 'text', 420, 'false', 'map-geography.json', []],
      [5, '05-geo-climate.md', 'Climate Change Is Redrawing the Map', 'text', 360, 'false', null, ['bunn-2015']],
      [6, '06-social-coffeehouse.md', 'The Coffeehouse Revolution', 'text', 480, 'false', null, ['royal-proclamation-1675', 'womens-petition-1674', 'mens-answer-1674']],
      [7, '07-social-two-truths.md', 'Two Truths: Democracy and Colonial Labor', 'text', 420, 'false', 'map-trade.json', ['colonial-plantation-records']],
      [8, '08-econ-bean-to-cup.md', 'Follow the Money: Bean to Cup', 'text', 420, 'false', null, []],
      [9, '09-econ-trade-models.md', 'Fair Trade, Direct Trade, and Commodity', 'text', 420, 'false', null, []],
      [10, '10-econ-price-shocks.md', 'Price Shocks and Why You Keep Buying', 'text', 420, 'false', null, []],
      [11, '11-ela-words.md', 'The Words Coffee Carries', 'text', 360, 'false', null, []],
      [12, '12-ela-ceremony.md', 'The Ethiopian Ceremony as Story', 'text', 360, 'false', null, []],
      [13, '13-ela-ads.md', 'Reading a Coffee Ad', 'text', 420, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Coffee', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Coffee', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Coffee', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Coffee', 'quiz', 720, 'false', null, []],
    ],
  },
  tea: {
    ep: 2, moduleTitle: 'Episode 2: Tea — The Way of Tea', moduleOrder: 2,
    lessons: [
      [2, '02-intro.md', 'Tea, and the Plant Behind Every Cup', 'text', 180, 'true', null, ['teacher-resources']],
      [3, '03-geo-climate-zones.md', 'The Tea Plant and Its Climate Zones', 'text', 420, 'true', null, []],
      [4, '04-geo-producers.md', 'The Big Producers and the First Flush', 'text', 360, 'false', 'map-geography.json', []],
      [5, '05-geo-trade-routes.md', 'The Roads Tea Traveled', 'text', 420, 'false', 'map-trade.json', []],
      [6, '06-social-origins-ceremony.md', 'From Medicine to Ceremony', 'text', 480, 'false', null, []],
      [7, '07-social-boston-tea-party.md', 'The Boston Tea Party', 'text', 420, 'false', null, ['boston-tea-party-loc']],
      [8, '08-social-who-grows-tea.md', 'Who Grows the Tea', 'text', 360, 'false', null, []],
      [9, '09-econ-one-leaf-many-teas.md', 'One Leaf, Many Teas', 'text', 420, 'false', null, []],
      [10, '10-econ-who-gets-paid.md', 'Who Gets Paid, Tea and Coffee Compared', 'text', 420, 'false', null, []],
      [11, '11-ela-cha-and-te.md', 'Cha and Te', 'text', 360, 'false', null, []],
      [12, '12-ela-classic-and-way.md', 'The Classic of Tea and the Way of Tea', 'text', 360, 'false', null, ['okakura-book-of-tea', 'classic-of-tea']],
      [13, '13-ela-tea-ad.md', 'Reading a Tea Ad', 'text', 420, 'false', null, ['orwell-nice-cup-of-tea']],
      [14, '14-key-terms.md', 'Key Terms: Tea', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Tea', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Tea', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Tea', 'quiz', 720, 'false', null, []],
    ],
  },
  chocolate: {
    ep: 3, moduleTitle: 'Episode 3: Chocolate — Food of the Gods', moduleOrder: 3,
    lessons: [
      [2, '02-intro.md', 'Chocolate, the Food of the Gods', 'text', 180, 'true', null, ['teacher-resources']],
      [3, '03-geo-cacao-tree.md', 'The Cacao Tree and the Narrowest Belt', 'text', 420, 'true', null, []],
      [4, '04-geo-producers.md', 'The Big Producers and the Cacao Varieties', 'text', 420, 'false', 'map-geography.json', []],
      [5, '05-geo-climate.md', 'A Two-Degree Threat', 'text', 360, 'false', null, []],
      [6, '06-social-food-of-gods.md', 'Food of the Gods', 'text', 480, 'false', 'map-trade.json', ['popol-vuh', 'florentine-codex']],
      [7, '07-social-great-reversal.md', 'Conquest and the Great Reversal', 'text', 420, 'false', null, ['cortes-letters']],
      [8, '08-social-children-in-cacao.md', 'The Children in the Cacao', 'text', 360, 'false', null, ['cocoa-barometer']],
      [9, '09-econ-commodity-trap.md', 'The Commodity Trap', 'text', 420, 'false', null, []],
      [10, '10-econ-50-cent-question.md', 'The Fifty-Cent Question', 'text', 420, 'false', null, []],
      [11, '11-ela-cacao-cocoa-chocolate.md', 'Cacao, Cocoa, Chocolate', 'text', 360, 'false', null, []],
      [12, '12-ela-two-ways-of-seeing.md', 'Two Ways of Seeing a Bean', 'text', 360, 'false', null, ['cortes-letters', 'popol-vuh', 'florentine-codex']],
      [13, '13-ela-chocolate-ad.md', 'Reading a Chocolate Ad', 'text', 420, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Chocolate', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Chocolate', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Chocolate', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Chocolate', 'quiz', 720, 'false', null, []],
    ],
  },
  sugar: {
    ep: 4, moduleTitle: 'Episode 4: Sugar — The Sweet Revolution', moduleOrder: 4,
    lessons: [
      [2, '02-intro.md', 'Sugar, the Sweet Revolution', 'text', 180, 'true', null, ['teacher-resources']],
      [3, '03-geo-two-plants.md', 'Two Plants, One Sweetness', 'text', 420, 'true', null, []],
      [4, '04-geo-where-sugar-grows.md', 'Where Sugar Grows', 'text', 360, 'false', 'map-geography.json', []],
      [5, '05-geo-sugar-islands.md', 'The Sugar Islands', 'text', 360, 'false', null, []],
      [6, '06-social-new-world.md', 'From New Guinea to the New World', 'text', 360, 'false', null, []],
      [7, '07-social-triangular-trade.md', 'The Triangular Trade and the Middle Passage', 'text', 480, 'false', 'map-trade.json', ['equiano']],
      [8, '08-social-resistance.md', 'Resistance and Revolution', 'text', 420, 'false', null, ['mary-prince']],
      [9, '09-econ-from-luxury-to-cheap.md', 'From Luxury to the Cheapest Calorie', 'text', 420, 'false', null, []],
      [10, '10-econ-hidden-costs.md', 'The Hidden Costs of Cheap Sugar', 'text', 420, 'false', null, []],
      [11, '11-ela-words-of-sugar.md', 'The Words of Sugar', 'text', 360, 'false', null, []],
      [12, '12-ela-whose-voice.md', 'Whose Voice Tells the Story', 'text', 420, 'false', null, ['beckford-jamaica', 'equiano', 'mary-prince', 'austen-mansfield']],
      [13, '13-ela-blood-sweetened.md', 'Blood-Sweetened Luxury', 'text', 360, 'false', null, ['clarkson-essay']],
      [14, '14-key-terms.md', 'Key Terms: Sugar', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Sugar', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Sugar', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Sugar', 'quiz', 720, 'false', null, []],
    ],
  },
  'forest-wisdom': {
    ep: 5, moduleTitle: 'Episode 5: Guayusa & Kola Nut — Forest Wisdom', moduleOrder: 5,
    lessons: [
      [2, '02-intro.md', 'Forest Wisdom: Guayusa and the Kola Nut', 'text', 180, 'true', null, ['teacher-resources']],
      [3, '03-geo-two-plants.md', 'Two Plants of the Forest', 'text', 360, 'true', null, []],
      [4, '04-geo-chemistry-is-relationship.md', 'Chemistry Is Relationship', 'text', 360, 'false', 'map-geography.json', []],
      [5, '05-geo-forests-under-threat.md', 'Forests Under Threat', 'text', 360, 'false', null, []],
      [6, '06-social-pre-dawn-and-kola-road.md', 'The Pre-Dawn Cup and the Kola Road', 'text', 420, 'false', 'map-trade.json', []],
      [7, '07-social-coca-cola-and-biopiracy.md', 'How Coca-Cola Got Its Name', 'text', 420, 'false', null, ['pendergrast-coca-cola']],
      [8, '08-social-whose-knowledge.md', 'Whose Knowledge Is It', 'text', 420, 'false', null, ['un-declaration', 'wipo-treaty']],
      [9, '09-econ-reciprocity-economy.md', 'The Reciprocity Economy', 'text', 420, 'false', null, []],
      [10, '10-econ-biopiracy-benefit-sharing.md', 'Biopiracy and Benefit-Sharing', 'text', 420, 'false', null, []],
      [11, '11-ela-two-ways-of-knowing.md', 'Two Ways of Knowing', 'text', 360, 'false', null, ['lewis-2003']],
      [12, '12-ela-wisdom-of-proverbs.md', 'The Wisdom of Proverbs', 'text', 360, 'false', null, []],
      [13, '13-ela-water-pretending.md', 'Water Pretending to Be Wisdom', 'text', 360, 'false', null, ['aidoo']],
      [14, '14-key-terms.md', 'Key Terms: Forest Wisdom', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Forest Wisdom', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Forest Wisdom', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Forest Wisdom', 'quiz', 720, 'false', null, []],
    ],
  },
  kava: {
    ep: 6, moduleTitle: 'Episode 6: Kava — The Root of Peace', moduleOrder: 6,
    lessons: [
      [2, '02-intro.md', 'Kava, the Root of Peace', 'text', 180, 'true', null, ['teacher-resources']],
      [3, '03-geo-volcanic-islands.md', 'A Plant of Volcanic Islands', 'text', 360, 'true', null, []],
      [4, '04-geo-why-volcanic-soil.md', 'Why Volcanic Soil Only', 'text', 360, 'false', 'map-geography.json', []],
      [5, '05-geo-islands-under-pressure.md', 'Islands Under Pressure', 'text', 360, 'false', null, []],
      [6, '06-social-root-of-peace.md', 'The Root of Peace', 'text', 480, 'false', 'map-trade.json', ['lebot-1992']],
      [7, '07-social-kava-governs.md', 'Kava Governs', 'text', 420, 'false', null, []],
      [8, '08-social-who-sits-at-the-bowl.md', 'Who Sits at the Bowl', 'text', 360, 'false', null, []],
      [9, '09-econ-ceremony-meets-market.md', 'Ceremony Meets the Market', 'text', 420, 'false', null, ['singh-2002']],
      [10, '10-econ-who-benefits.md', 'Who Benefits from the Boom', 'text', 420, 'false', null, []],
      [11, '11-ela-root-that-heals.md', 'The Root That Heals', 'text', 360, 'false', null, ['lebot-1992']],
      [12, '12-ela-roots-and-proverbs.md', 'Roots and Proverbs', 'text', 360, 'false', null, []],
      [13, '13-ela-kava-compass.md', 'The Kava Compass', 'text', 360, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Kava', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Kava', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Kava', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Kava', 'quiz', 720, 'false', null, []],
    ],
  },
  synthesis: {
    ep: 7, moduleTitle: 'Episode 7: My Daily Altar — Season Synthesis', moduleOrder: 7,
    lessons: [
      [2, '02-intro.md', 'My Daily Altar: Looking Back at the Season', 'text', 180, 'true', null, ['teacher-resources']],
      [3, '03-geo-the-geography-pattern.md', 'The Geography Pattern', 'text', 420, 'true', 'map-geography.json', []],
      [4, '04-geo-the-climate-pattern.md', 'The Climate Pattern', 'text', 360, 'false', null, []],
      [5, '05-social-same-story-six-times.md', 'The Same Story, Six Times', 'text', 420, 'false', null, []],
      [6, '06-social-people-behind-every-cup.md', 'The People Behind Every Cup', 'text', 420, 'false', null, []],
      [7, '07-social-long-fight-for-justice.md', 'The Long Fight for Justice', 'text', 420, 'false', null, []],
      [8, '08-econ-who-captures-the-value.md', 'Who Captures the Value', 'text', 420, 'false', null, ['mintz-sweetness']],
      [9, '09-econ-two-ways-of-doing-economics.md', 'Two Ways of Doing Economics', 'text', 420, 'false', null, []],
      [10, '10-ela-the-stories-we-tell.md', 'The Stories We Tell', 'text', 420, 'false', null, []],
      [11, '11-ela-a-plants-eye-view.md', "A Plant's-Eye View", 'text', 360, 'false', null, ['pollan-botany']],
      [12, '12-my-daily-altar.md', 'My Daily Altar', 'text', 360, 'false', null, ['kimmerer-sweetgrass']],
      [13, '13-key-terms.md', 'Key Terms: Season Synthesis', 'text', 300, 'false', null, []],
      [14, '14-review.md', 'Cumulative Review: The Whole Season', 'text', 360, 'false', null, []],
      [15, '15-references.md', 'Sources and Further Reading: The Season', 'text', 180, 'false', null, []],
      [16, '16-quiz.md', 'Knowledge Check: Season Synthesis', 'quiz', 720, 'false', null, []],
    ],
  },
  beer: {
    ep: 8, moduleTitle: 'Episode 8: Beer — Liquid Bread', moduleOrder: 8,
    lessons: [
      [2, '02-intro.md', 'Liquid Bread: The Grain That Built Civilization', 'text', 180, 'true', null, ['teacher-resources', 'niaaa-alcohol']],
      [3, '03-geo-grain-and-hop-belts.md', 'The Grain Belt and the Hop Belt', 'text', 360, 'true', null, []],
      [4, '04-geo-how-geology-makes-beer.md', 'How Geology Makes the Beer', 'text', 420, 'false', 'map-geography.json', []],
      [5, '05-geo-shifting-geography.md', 'Beer Geography Is Shifting', 'text', 300, 'false', null, []],
      [6, '06-social-liquid-bread-first-cities.md', 'Liquid Bread and the First Cities', 'text', 420, 'false', 'map-trade.json', ['code-of-hammurabi']],
      [7, '07-social-monks-who-kept-brewing.md', 'The Monks Who Kept Brewing', 'text', 420, 'false', null, []],
      [8, '08-social-prohibition.md', 'Prohibition, the Experiment That Failed', 'text', 420, 'false', null, []],
      [9, '09-econ-who-gets-paid-for-a-pint.md', 'Who Gets Paid for a Pint', 'text', 420, 'false', null, ['brewers-association']],
      [10, '10-econ-macro-vs-craft.md', 'Macro Beer and Craft Beer', 'text', 420, 'false', null, []],
      [11, '11-ela-hymn-to-ninkasi.md', 'The Hymn to Ninkasi', 'text', 360, 'false', null, ['hymn-to-ninkasi']],
      [12, '12-ela-selling-prohibition.md', 'Selling Prohibition', 'text', 360, 'false', null, []],
      [13, '13-ela-reading-a-beer-label.md', 'Reading a Craft Beer Label', 'text', 360, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Beer', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Beer', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Beer', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Beer', 'quiz', 720, 'false', null, []],
    ],
  },
  wine: {
    ep: 9, moduleTitle: 'Episode 9: Wine — Blood of the Earth', moduleOrder: 9,
    lessons: [
      [2, '02-intro.md', 'Blood of the Earth: A Drink That Tastes of Place', 'text', 180, 'true', null, ['teacher-resources', 'niaaa-alcohol']],
      [3, '03-geo-the-wine-belt.md', 'The Wine Belt: Where Grapes Grow', 'text', 360, 'true', null, []],
      [4, '04-geo-terroir.md', 'Terroir, the Taste of Place', 'text', 420, 'false', 'map-geography.json', []],
      [5, '05-geo-phylloxera.md', 'The Phylloxera Crisis: An American Bug and an American Cure', 'text', 360, 'false', null, []],
      [6, '06-social-wine-power-sacred.md', 'Wine, Power, and the Sacred', 'text', 420, 'false', null, ['pnas-georgia-wine']],
      [7, '07-social-georgian-qvevri.md', 'The Georgian Qvevri', 'text', 420, 'false', 'map-trade.json', ['unesco-qvevri']],
      [8, '08-social-judgment-of-paris.md', 'The Judgment of Paris', 'text', 420, 'false', null, ['judgment-of-paris']],
      [9, '09-social-dop-system.md', 'The Dop System', 'text', 480, 'false', null, []],
      [10, '10-econ-business-of-prestige.md', 'The Business of Prestige', 'text', 480, 'false', null, []],
      [11, '11-econ-asset-and-boycott.md', 'Wine as an Asset, and the Boycott That Worked', 'text', 480, 'false', null, []],
      [12, '12-ela-persian-poetry.md', 'Wine in Persian Poetry', 'text', 360, 'false', null, []],
      [13, '13-ela-the-symposium.md', 'The Symposium', 'text', 360, 'false', null, []],
      [14, '14-ela-language-of-wine.md', 'The Language of Wine', 'text', 360, 'false', null, []],
      [15, '15-key-terms.md', 'Key Terms: Wine', 'text', 300, 'false', null, []],
      [16, '16-review.md', 'Cumulative Review: Wine', 'text', 360, 'false', null, []],
      [17, '17-references.md', 'Sources and Further Reading: Wine', 'text', 180, 'false', null, []],
      [18, '18-quiz.md', 'Knowledge Check: Wine', 'quiz', 720, 'false', null, []],
    ],
  },
  whiskey: {
    ep: 10, moduleTitle: 'Episode 10: Whiskey — Fire Water', moduleOrder: 10,
    lessons: [
      [2, '02-intro.md', 'Fire Water: The Spirit That Traveled the World', 'text', 180, 'true', null, ['teacher-resources', 'niaaa-alcohol']],
      [3, '03-geo-distillation-traveled.md', 'The Geography of Distillation', 'text', 360, 'true', 'map-trade.json', []],
      [4, '04-geo-karst-limestone-bourbon.md', 'Karst Limestone and Bourbon', 'text', 420, 'false', 'map-geography.json', ['scotch-whisky-assoc']],
      [5, '05-geo-geography-of-aging.md', 'The Geography of Aging', 'text', 360, 'false', null, []],
      [6, '06-social-rebellion-to-republic.md', 'From Rebellion to Republic', 'text', 480, 'false', null, []],
      [7, '07-social-man-who-taught-jack.md', 'The Man Who Taught Jack', 'text', 480, 'false', null, ['risen-nyt']],
      [8, '08-social-whisky-crosses-ocean.md', 'Whisky Crosses the Ocean', 'text', 420, 'false', null, []],
      [9, '09-econ-money-in-the-barrel.md', 'The Money in the Barrel', 'text', 480, 'false', null, []],
      [10, '10-econ-economics-of-attribution.md', 'The Economics of Attribution', 'text', 480, 'false', null, ['uncle-nearest']],
      [11, '11-science-what-proof-means.md', 'What Does Proof Mean?', 'text', 420, 'false', null, ['ttb-spirits']],
      [12, '12-ela-water-of-life.md', 'The Water of Life', 'text', 360, 'false', null, []],
      [13, '13-ela-oral-history-survived.md', 'The Oral History That Survived', 'text', 420, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Whiskey', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Whiskey', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Whiskey', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Whiskey', 'quiz', 720, 'false', null, []],
    ],
  },
  rum: {
    ep: 11, moduleTitle: 'Episode 11: Rum — Sweet Poison', moduleOrder: 11,
    lessons: [
      [2, '02-intro.md', 'Sweet Poison: The Spirit of Sugar and the Slave Trade', 'text', 180, 'true', null, ['teacher-resources', 'niaaa-alcohol']],
      [3, '03-geo-why-the-caribbean.md', 'Why the Caribbean', 'text', 360, 'true', null, []],
      [4, '04-geo-different-islands-different-rums.md', 'Different Islands, Different Rums', 'text', 420, 'false', 'map-geography.json', []],
      [5, '05-geo-triangular-trade.md', 'The Triangular Trade', 'text', 420, 'false', 'map-trade.json', ['slave-voyages', 'unesco-cape-coast']],
      [6, '06-geo-caribbean-today.md', 'The Caribbean Today', 'text', 300, 'false', null, []],
      [7, '07-social-haitian-revolution.md', 'The Haitian Revolution', 'text', 480, 'false', null, []],
      [8, '08-social-debt-of-freedom.md', 'The Debt of Freedom', 'text', 480, 'false', null, []],
      [9, '09-social-the-maroons.md', 'The Maroons', 'text', 480, 'false', null, []],
      [10, '10-econ-waste-product-economics.md', 'Waste-Product Economics', 'text', 480, 'false', null, []],
      [11, '11-econ-who-gets-paid-martinique.md', "Who Gets Paid, and Martinique's Answer", 'text', 480, 'false', null, ['martinique-aoc']],
      [12, '12-ela-black-jacobins.md', 'The Black Jacobins', 'text', 420, 'false', null, []],
      [13, '13-ela-tiki-tropical-paradise.md', 'Tiki and the Tropical Paradise', 'text', 420, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Rum', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Rum', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Rum', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Rum', 'quiz', 720, 'false', null, []],
    ],
  },
  'tequila-mezcal': {
    ep: 12, moduleTitle: 'Episode 12: Tequila & Mezcal — Heart of the Agave', moduleOrder: 12,
    lessons: [
      [2, '02-intro.md', 'Heart of the Agave: A Sacred Plant Made Spirit', 'text', 180, 'true', null, ['teacher-resources', 'niaaa-alcohol']],
      [3, '03-geo-the-stress-specialist.md', 'The Stress Specialist', 'text', 360, 'true', null, []],
      [4, '04-geo-highland-and-lowland.md', 'Highland and Lowland', 'text', 360, 'false', 'map-geography.json', []],
      [5, '05-geo-agave-and-time.md', 'Agave and Time', 'text', 360, 'false', null, []],
      [6, '06-social-the-sacred-plant.md', 'The Sacred Plant', 'text', 480, 'false', 'map-trade.json', []],
      [7, '07-social-burning-the-books.md', 'Burning the Books', 'text', 420, 'false', null, ['codex-mendoza']],
      [8, '08-social-sacred-to-commodity.md', 'From Sacred to Commodity', 'text', 480, 'false', null, []],
      [9, '09-econ-geographic-protectionism.md', 'Geographic Protectionism', 'text', 480, 'false', null, ['crt-tequila']],
      [10, '10-econ-the-jimadors-share.md', "The Jimador's Share", 'text', 480, 'false', null, []],
      [11, '11-econ-single-village-mezcal.md', 'Single Village Mezcal', 'text', 420, 'false', null, []],
      [12, '12-ela-reading-the-codex.md', 'Reading the Codex', 'text', 420, 'false', null, ['codex-mendoza']],
      [13, '13-ela-selling-the-sacred.md', 'Selling the Sacred', 'text', 420, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Tequila and Mezcal', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Tequila and Mezcal', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Tequila and Mezcal', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Tequila and Mezcal', 'quiz', 720, 'false', null, []],
    ],
  },
  sake: {
    ep: 13, moduleTitle: 'Episode 13: Sake — The Koji Path', moduleOrder: 13,
    lessons: [
      [2, '02-intro.md', 'The Koji Path: A Spirit Built by a Mold', 'text', 180, 'true', null, ['teacher-resources', 'niaaa-alcohol']],
      [3, '03-geo-koji-the-national-mold.md', 'Koji, the National Mold', 'text', 360, 'true', null, ['aspergillus-oryzae']],
      [4, '04-geo-three-waters-three-sakes.md', 'Three Waters, Three Sakes', 'text', 420, 'false', 'map-geography.json', []],
      [5, '05-geo-rice-wine-belt.md', 'The Rice-Wine Belt of Asia', 'text', 360, 'false', 'map-trade.json', []],
      [6, '06-social-sake-and-the-sacred.md', 'Sake and the Sacred', 'text', 420, 'false', null, []],
      [7, '07-social-suppression-of-makgeolli.md', 'The Suppression of Makgeolli', 'text', 420, 'false', null, []],
      [8, '08-social-why-fermentation-is-sacred.md', 'Why Fermentation Is Sacred', 'text', 420, 'false', null, []],
      [9, '09-econ-volume-to-value.md', 'Volume to Value', 'text', 420, 'false', null, ['japan-sake-assoc']],
      [10, '10-econ-the-polishing-ratio.md', 'The Polishing Ratio', 'text', 420, 'false', null, []],
      [11, '11-econ-the-toji-guild.md', 'The Toji Guild', 'text', 420, 'false', null, []],
      [12, '12-ela-words-english-borrowed.md', 'Words English Had to Borrow', 'text', 360, 'false', null, []],
      [13, '13-ela-the-beauty-of-passing.md', 'The Beauty of Passing', 'text', 420, 'false', null, ['manyoshu']],
      [14, '14-key-terms.md', 'Key Terms: Sake', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Sake', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Sake', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Sake', 'quiz', 720, 'false', null, []],
    ],
  },
  'the-toast': {
    ep: 14, moduleTitle: 'Episode 14: The Toast — Season Synthesis', moduleOrder: 14,
    lessons: [
      [2, '02-intro.md', 'The Toast: Four Patterns in Every Glass', 'text', 180, 'true', null, ['teacher-resources', 'niaaa-alcohol']],
      [3, '03-pattern1-ground-speaks-first.md', 'Pattern 1: The Ground Speaks First', 'text', 360, 'true', 'map-geography.json', []],
      [4, '04-pattern1-stress-and-care.md', 'Pattern 1, Continued: Stress and Care', 'text', 300, 'false', null, []],
      [5, '05-pattern2-fermentation-begins-sacred.md', 'Pattern 2: Fermentation Begins Sacred', 'text', 420, 'false', null, ['who-alcohol']],
      [6, '06-pattern2-what-was-lost.md', 'Pattern 2, Continued: What Was Lost and What Came Back', 'text', 420, 'false', null, []],
      [7, '07-pattern3-the-smile-curve.md', 'Pattern 3: Labor Captures the Smallest Share', 'text', 420, 'false', null, []],
      [8, '08-pattern3-changing-the-curve.md', 'Pattern 3, Continued: Can the Curve Be Changed?', 'text', 420, 'false', null, []],
      [9, '09-pattern4-whose-story-survives.md', 'Pattern 4: Whose Story Survives', 'text', 420, 'false', null, []],
      [10, '10-pattern4-what-gets-saved.md', 'Pattern 4, Continued: What Gets Burned, What Gets Saved', 'text', 420, 'false', null, []],
      [11, '11-the-toast-in-ten-languages.md', 'The Toast in Ten Languages', 'text', 360, 'false', 'map-trade.json', []],
      [12, '12-key-terms.md', 'Key Terms: The Four Patterns', 'text', 300, 'false', null, []],
      [13, '13-review.md', 'Cumulative Review: The Whole Season', 'text', 360, 'false', null, []],
      [14, '14-references.md', 'Sources and Further Reading: The Toast', 'text', 180, 'false', null, []],
      [15, '15-quiz.md', 'Knowledge Check: The Toast', 'quiz', 720, 'false', null, []],
    ],
  },
  tobacco: {
    ep: 15, moduleTitle: 'Episode 15: Tobacco — Sacred Smoke', moduleOrder: 15,
    lessons: [
      [2, '02-intro.md', 'Sacred Smoke: Legal, Deadly, and the Bridge to Season 3', 'text', 180, 'true', null, ['teacher-resources', 'samhsa-help']],
      [3, '03-geo-the-tobacco-belt.md', 'The Tobacco Belt', 'text', 360, 'true', 'map-geography.json', []],
      [4, '04-geo-belt-and-plantation.md', 'The Belt and the Plantation', 'text', 360, 'false', null, []],
      [5, '05-geo-footprint-beyond-the-leaf.md', 'The Footprint Beyond the Leaf', 'text', 300, 'false', null, []],
      [6, '06-social-the-sacred-pipe.md', 'The Sacred Pipe', 'text', 480, 'false', null, []],
      [7, '07-social-sacred-to-commodity.md', 'From Sacred to Commodity', 'text', 420, 'false', 'map-trade.json', []],
      [8, '08-social-doubt-is-our-product.md', 'Doubt Is Our Product', 'text', 420, 'false', null, ['truth-tobacco-documents']],
      [9, '09-econ-trillion-dollar-contradiction.md', 'The Trillion-Dollar Contradiction', 'text', 420, 'false', null, ['who-tobacco']],
      [10, '10-econ-who-pays-for-a-cigarette.md', 'Who Pays for a Cigarette', 'text', 420, 'false', null, []],
      [11, '11-econ-the-settlement-that-wasnt.md', "The Settlement That Wasn't", 'text', 420, 'false', null, []],
      [12, '12-ela-torches-of-freedom.md', 'Torches of Freedom', 'text', 360, 'false', null, ['stanford-srita']],
      [13, '13-ela-the-language-of-doubt.md', 'The Language of Doubt', 'text', 360, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Tobacco', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Tobacco', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Tobacco', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Tobacco', 'quiz', 720, 'false', null, []],
    ],
  },
  cannabis: {
    ep: 16, moduleTitle: 'Episode 16: Cannabis — The Green Revolution', moduleOrder: 16,
    lessons: [
      [2, '02-intro.md', 'The Green Revolution: A Plant on Trial', 'text', 180, 'true', null, ['teacher-resources', 'samhsa-help', 'nida-cannabis']],
      [3, '03-geo-born-in-the-mountains.md', 'Born in the Mountains', 'text', 360, 'true', 'map-geography.json', []],
      [4, '04-geo-the-legal-patchwork.md', 'The Legal Patchwork', 'text', 360, 'false', 'map-trade.json', []],
      [5, '05-geo-hemp-comes-home.md', 'Hemp Comes Home', 'text', 300, 'false', null, []],
      [6, '06-social-the-sacred-plant.md', 'The Sacred Plant', 'text', 420, 'false', null, []],
      [7, '07-social-how-cannabis-became-a-crime.md', 'How Cannabis Became a Crime', 'text', 480, 'false', null, ['baum-harpers']],
      [8, '08-social-the-disparity.md', 'The Disparity', 'text', 420, 'false', null, ['aclu-report']],
      [9, '09-econ-the-billion-dollar-leaf.md', 'The Billion-Dollar Leaf', 'text', 420, 'false', null, []],
      [10, '10-econ-the-justice-gap.md', 'The Justice Gap', 'text', 420, 'false', null, []],
      [11, '11-econ-indiana-on-the-border.md', 'Indiana on the Border', 'text', 420, 'false', null, []],
      [12, '12-ela-reefer-madness.md', 'Reefer Madness and the Language of Fear', 'text', 420, 'false', null, []],
      [13, '13-ela-three-sentences-three-policies.md', 'Three Sentences, Three Policies', 'text', 420, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Cannabis', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Cannabis', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Cannabis', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Cannabis', 'quiz', 720, 'false', null, []],
    ],
  },
};
const slug = process.argv[2];
if (!slug || !EPISODES[slug]) { console.error(`usage: generate-bvc-episode-csv.mjs <episode-slug>`); process.exit(1); }
const { ep, moduleTitle, moduleOrder, lessons } = EPISODES[slug];
const SRC = join(ROOT, 'plans/BVC/ver1', slug);
const OUT = join(ROOT, 'public/templates', `bvc-episode-${ep}-${slug}-lessons.csv`);

const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';
function esc(v) { if (v === null || v === undefined || v === '') return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function body(file) {
  const raw = readFileSync(join(SRC, file), 'utf8'); const lines = raw.split('\n'); let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.startsWith('# ')) { i++; while (i < lines.length && lines[i].trim() === '') i++; }
  return lines.slice(i).join('\n').trim();
}
function jmin(file) { return JSON.stringify(JSON.parse(readFileSync(join(SRC, file), 'utf8'))); }
function isHttps(u) { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } }

const docs = JSON.parse(readFileSync(join(SRC, 'documents.json'), 'utf8'));
const docById = new Map(docs.filter((d) => isHttps(d.url)).map((d) => [d.id, { title: d.title, description: d.description, url: d.url, source_url: d.source_url ?? null }]));

const rows = lessons.map(([order, file, title, type, dur, free, mapFile, docIds]) => {
  const map = mapFile && existsSync(join(SRC, mapFile)) ? jmin(mapFile) : '';
  const quiz = type === 'quiz' ? jmin('quiz.json') : '';
  const attach = docIds.map((id) => docById.get(id)).filter(Boolean);
  const documents = attach.length ? JSON.stringify(attach) : '';
  return [moduleTitle, moduleOrder, order, title, type, dur, free, '', body(file), 'markdown', '', '', map, documents, '', quiz];
});

const csv = [HEADER, ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
writeFileSync(OUT, csv, 'utf8');
console.log(`Wrote ${OUT} (${rows.length} lessons; audio lesson preserved separately by bvc-academy-load.mjs)`);
