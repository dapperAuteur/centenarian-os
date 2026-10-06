# Calendar event cheat sheet: titles CentenarianOS can read

Add a `#tag` and a few details to a Google Calendar event title. When the event syncs into CentenarianOS (Settings > Calendar Sync), the title is read. English and Spanish words both work, whatever your language setting.

**What happens when an event syncs:** every synced event becomes a planner task named after the title without its tags. A tagged title also creates a record linked to that task: #expense and #income a transaction (in the default account ticked for that Google account in Calendar Sync, or the one an `@account` names, in its currency), #meal a meal log, #workout a workout log. #trip events stay tasks: the trip details are saved and will go to RideWitUS. A title with missing details (an #expense with no amount) creates only the task and is flagged under Needs a look.

## Copy-paste titles

| Kind | English | Spanish |
|---|---|---|
| Expense | `Groceries Corner Market #expense $42.18` | `Compras Mercado Central #gasto $42.18` |
| Income | `Client payment Acme Studio #income $1500.00` | `Pago de cliente Acme Studio #ingreso $1500.00` |
| Trip | `To the trailhead #trip 7.8mi mode:bike` | `Al parque #viaje 12.5km mode:bici` |
| Meal | `Lunch Corner Cafe #meal` | `Almuerzo Café de la Esquina #comida` |
| Workout | `Strength session #workout 45min` | `Sesión de fuerza #entreno 45min` |
| Task | `Call the plumber #task` | `Llamar al plomero #tarea` |

## The tags

| Kind | Tags | Needs |
|---|---|---|
| Expense | `#expense`, `#gasto` | an amount: `$12.40`, `12.40`, `12,40` |
| Income | `#income`, `#ingreso` | an amount, as for an expense |
| Trip | `#trip`, `#viaje` | a distance: `115mi`, `12.5 km`; optional `mode:bike` |
| Meal | `#meal`, `#comida` | nothing; a meal word or the start time sets the meal |
| Workout | `#workout`, `#entreno`, `#ejercicio` | nothing; add a duration such as `45min` |
| Task | `#task`, `#tarea` | nothing; a title with no tag is a task too |

## Details

- **Amount** (expense, income): a `$` amount wins. Without `$`, a number with cents counts; a whole number counts only when it is the only number in the title, and never one that looks like a year (1900-2100). The `$` is only a marker: the amount is not converted between currencies.
- **Account** (expense, income): `@` and the last four digits of an account ticked in Calendar Sync, or the nickname set next to it there: `Lunch Chipotle #expense $12.40 @1234`, `Dinner #expense $40 @visa`. Without one, the default account is used. An `@account` that is not ticked, matches nothing, or matches two ticked accounts (give one a nickname) creates no transaction and is flagged. Right after a meal word, `@word` is still the vendor (`Dinner @Nobu`), unless it is four digits.
- **Distance** (trips): a number with `mi`, `mile`, `miles`, `milla`, `millas`, `km`, `kms`, `kilometer`, `kilometers`, `kilómetro`, `kilómetros`, `kilometro`, `kilometros`. Write it attached (`12km`) or with a space (`12 km`). Kilometers are converted to miles and stored rounded to 0.1 mi.
- **Mode** (trips): `mode:word` with one of `drive`, `car`, `coche`, `carro`, `bike`, `bici`, `walk`, `caminar`, `run`, `correr`, `flight`, `fly`, `plane`, `avión`, `avion`, `bus`, `train`, `tren`, `ferry`, `uber`, `lyft`, `rideshare`, or one of `bike`, `car`, `bus`, `train`, `plane`, `walk`, `run`, `ferry`, `rideshare`, `other`. Without `mode:`, one of the words in the first list anywhere in the title counts ("Drive to Tucson"); with neither, the title names no mode.
- **Meal** (meals): `breakfast`, `desayuno`, `lunch`, `almuerzo`, `dinner`, `cena`, `snack`, `merienda`, as a word in the title or as a tag (`#lunch`). Without one, the start time decides: 05:00-10:29 breakfast, 10:30-14:29 lunch, 17:00-21:29 dinner, any other time snack.
- **Duration** (any tagged title): a number with `min`, `mins`, `minute`, `minutes`, `minuto`, `minutos`, `h`, `hr`, `hrs`, `hour`, `hours`, `hora`, `horas`, for example `45min`, `1h`, `1h 30min`. A bare `m` (`90m`) works too, except on trips, where it would mean meters.
- **Other `#words`** are removed from the task name and flagged as unknown. A title with two different kind tags uses the first one.

## Location

Put the place in the event's Location field, not in the title. CentenarianOS adds it to the planner task's description, and the location is what RideWitUS uses: for a calendar you share with RideWitUS (Settings > Calendar Sync, off by default), events with a location are sent so it can suggest trips to and from them. Events without a location are never sent.

## When a title is flagged

The task is still created. Its description says what to check, and the account card on Settings > Calendar Sync counts it as flagged.

- No amount found. Add one such as $12.40.
- No distance found. Add one such as 12mi or 20km.
- More than one kind tag. Only the first one counts.
- More than one @account. Keep one, or none for the default account.
- A #word CentenarianOS does not know. It is removed from the task name and otherwise ignored.

Build and check a title, or open it straight in Google Calendar: Settings > Calendar Sync > Event builder (/dashboard/settings/calendar/event-builder).
