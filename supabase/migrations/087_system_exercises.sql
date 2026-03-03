-- 087_system_exercises.sql
-- Public system exercise library: pre-seeded with 110+ exercises
-- covering bodyweight, minimal equipment, and gym — all skill levels.
-- Users browse and copy exercises into their personal library.

BEGIN;

-- ── 1. System Exercise Library ─────────────────────────────────────────
CREATE TABLE system_exercises (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  category         TEXT NOT NULL,
  instructions     TEXT,
  form_cues        TEXT,
  primary_muscles  TEXT[],
  difficulty       TEXT NOT NULL DEFAULT 'beginner'
                     CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  equipment_needed TEXT NOT NULL DEFAULT 'none'
                     CHECK (equipment_needed IN ('none', 'minimal', 'gym')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_exercises_category  ON system_exercises (category);
CREATE INDEX idx_system_exercises_equipment ON system_exercises (equipment_needed);
CREATE INDEX idx_system_exercises_active    ON system_exercises (is_active);

-- All authenticated users can SELECT; writes via service role only
ALTER TABLE system_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_exercises_select ON system_exercises
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── 2. Seed ────────────────────────────────────────────────────────────

INSERT INTO system_exercises (name, category, instructions, form_cues, primary_muscles, difficulty, equipment_needed) VALUES

-- ═══════════════════════════════════════════════════════════════════════
-- PUSH — Bodyweight / No Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Push-Up',
  'Push',
  'Start in a high plank with hands shoulder-width apart and body forming a straight line from head to heels. Bend your elbows to lower your chest to an inch above the floor, then press back to the start. Keep your core engaged throughout.',
  'Pack your shoulder blades. Keep elbows at roughly 45° from your torso, not flared wide. Don''t let your hips sag or pike up.',
  ARRAY['chest','triceps','anterior deltoid','core'],
  'beginner', 'none'
),
(
  'Diamond Push-Up',
  'Push',
  'Place hands close together under your sternum, forming a diamond shape with your thumbs and forefingers. Lower your chest toward your hands, keeping elbows close to your body, then press back up.',
  'Keep elbows tracking straight back, not outward. Engage your core to prevent hip sag. Control the descent.',
  ARRAY['triceps','chest','anterior deltoid'],
  'intermediate', 'none'
),
(
  'Wide Push-Up',
  'Push',
  'Place hands roughly 1.5× shoulder-width apart. Lower your chest between your hands while keeping your body straight, then push back up. The wider grip shifts emphasis onto the chest.',
  'Think about squeezing your hands toward each other on the way up to maximize chest activation. Don''t flare elbows past 90°.',
  ARRAY['chest','triceps','anterior deltoid'],
  'beginner', 'none'
),
(
  'Decline Push-Up',
  'Push',
  'Place your feet on an elevated surface (bench, chair, or step) and hands on the floor shoulder-width apart. Lower your chest toward the floor then press back. The elevated feet increase upper-chest and shoulder involvement.',
  'Maintain a rigid plank. The higher the feet, the more shoulder-dominant the movement becomes.',
  ARRAY['upper chest','anterior deltoid','triceps'],
  'intermediate', 'none'
),
(
  'Incline Push-Up',
  'Push',
  'Place hands on an elevated surface (counter, bench, or step) and body in a diagonal plank. Lower your chest to the surface then push back up. Easier than a floor push-up — great for beginners or as a warmup.',
  'Keep body straight from head to heels. Lower the surface height to progressively increase difficulty.',
  ARRAY['lower chest','triceps','anterior deltoid'],
  'beginner', 'none'
),
(
  'Pike Push-Up',
  'Push',
  'Start in a downward-dog position with hips raised high and back flat. Bend your elbows to lower the crown of your head toward the floor between your hands, then press back up.',
  'Keep your hips high to maximize shoulder loading. Look at the floor just beyond your hands.',
  ARRAY['anterior deltoid','triceps','upper trapezius'],
  'intermediate', 'none'
),
(
  'Archer Push-Up',
  'Push',
  'Start in a wide push-up position. Shift your weight toward one arm, bending it while the opposite arm stays nearly straight. Lower until your working-side chest nears the floor, then push back up. Alternate sides.',
  'The straight arm acts as a counterbalance. This is a stepping stone toward a one-arm push-up.',
  ARRAY['chest','triceps','anterior deltoid','core'],
  'advanced', 'none'
),
(
  'Tricep Dip (Chair)',
  'Push',
  'Sit on the edge of a chair with hands gripping the seat beside your hips. Slide forward off the seat, lowering your hips toward the floor by bending your elbows to 90°, then press back up.',
  'Keep your back close to the chair. Point elbows straight back, not outward. Don''t shrug your shoulders.',
  ARRAY['triceps','anterior deltoid','chest'],
  'beginner', 'none'
),
(
  'Handstand Push-Up',
  'Push',
  'Kick up into a wall-supported handstand with hands 6–12 inches from the wall, shoulder-width apart. Lower the crown of your head to the floor then press back to fully extended arms.',
  'Build up using pike push-ups and elevated pike push-ups first. Keep core tight and legs pressed into the wall.',
  ARRAY['anterior deltoid','triceps','upper trapezius'],
  'advanced', 'none'
),

-- ═══════════════════════════════════════════════════════════════════════
-- PULL — Bodyweight / Minimal Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Pull-Up',
  'Pull',
  'Hang from a bar with palms facing away from you, hands slightly wider than shoulder-width. Pull your chest to the bar by driving your elbows down and back, then lower with control.',
  'Initiate by depressing your scapulae before bending your elbows. Avoid kipping unless training for speed. Full hang at the bottom.',
  ARRAY['latissimus dorsi','biceps','rear deltoid','core'],
  'intermediate', 'minimal'
),
(
  'Chin-Up',
  'Pull',
  'Hang from a bar with palms facing toward you (supinated), hands shoulder-width or narrower. Pull your chin over the bar, leading with your elbows, then lower with control.',
  'Supinated grip increases bicep involvement compared to a pull-up. Same scapular depression cue applies.',
  ARRAY['biceps','latissimus dorsi','rear deltoid'],
  'intermediate', 'minimal'
),
(
  'Negative Pull-Up',
  'Pull',
  'Jump or step up to the top pull-up position (chin over bar). Slowly lower yourself over 4–8 seconds until arms are fully extended. Step back up and repeat.',
  'Eccentric-only training builds the strength needed for full pull-ups. Control the descent — don''t just fall.',
  ARRAY['latissimus dorsi','biceps','rear deltoid'],
  'beginner', 'minimal'
),
(
  'Inverted Row',
  'Pull',
  'Set a bar at waist height (or use a sturdy table). Hang below it with straight arms, body in a straight line at roughly 45°. Pull your chest to the bar by driving elbows back, then lower with control.',
  'Adjust difficulty by changing your foot position — feet further forward makes it harder. Squeeze shoulder blades together at the top.',
  ARRAY['latissimus dorsi','rhomboids','biceps','rear deltoid'],
  'beginner', 'none'
),
(
  'Superman',
  'Pull',
  'Lie face-down with arms extended overhead. Simultaneously lift your arms, chest, and legs off the floor, squeezing your glutes and back muscles. Hold briefly at the top then lower.',
  'Avoid straining your neck — look at the floor. Focus on squeezing through the entire posterior chain.',
  ARRAY['erector spinae','glutes','rear deltoid','hamstrings'],
  'beginner', 'none'
),

-- ═══════════════════════════════════════════════════════════════════════
-- LEGS — Bodyweight / No Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Squat',
  'Legs',
  'Stand with feet shoulder-width apart, toes slightly turned out. Push your hips back and down until your thighs are at least parallel to the floor, keeping your chest up. Drive through your heels to stand.',
  'Keep your knees tracking over your toes. Don''t let your chest cave forward. Brace your core throughout.',
  ARRAY['quadriceps','glutes','hamstrings','core'],
  'beginner', 'none'
),
(
  'Jump Squat',
  'Legs',
  'Perform a squat, then explode upward at the top to leave the ground. Land softly with bent knees and go straight into the next rep.',
  'Land through your toes first then heel. Absorb the landing — don''t let your knees cave inward. Use your arms for momentum.',
  ARRAY['quadriceps','glutes','hamstrings','calves'],
  'intermediate', 'none'
),
(
  'Lunge',
  'Legs',
  'Stand tall and step one foot forward, lowering your back knee toward the floor while keeping your front shin vertical. Push through the front heel to return to standing.',
  'Keep your torso upright throughout. Front knee should stay behind or over your front toes, not caving inward.',
  ARRAY['quadriceps','glutes','hamstrings'],
  'beginner', 'none'
),
(
  'Reverse Lunge',
  'Legs',
  'Stand tall and step one foot backward, lowering your back knee toward the floor. Push through your front heel to bring the back foot forward and return to standing.',
  'Stepping back is easier on the knees than a forward lunge. Keep your torso upright and core engaged.',
  ARRAY['quadriceps','glutes','hamstrings'],
  'beginner', 'none'
),
(
  'Bulgarian Split Squat',
  'Legs',
  'Stand facing away from a bench or step, placing your rear foot on the surface. Lower your front knee toward the floor in a lunge pattern, keeping your front shin mostly vertical, then drive back up.',
  'Position your front foot far enough forward that your shin stays vertical at the bottom. Control the descent. Most of your weight should be on the front leg.',
  ARRAY['quadriceps','glutes','hamstrings'],
  'intermediate', 'none'
),
(
  'Wall Sit',
  'Legs',
  'Stand with your back against a wall and slide down until your thighs are parallel to the floor and your shins are vertical. Hold the position for time.',
  'Keep your back flat against the wall. Don''t let your knees drift past your toes. Press your heels into the floor.',
  ARRAY['quadriceps','glutes'],
  'beginner', 'none'
),
(
  'Glute Bridge',
  'Legs',
  'Lie on your back with knees bent and feet flat on the floor hip-width apart. Drive through your heels to lift your hips toward the ceiling until your body forms a straight line from shoulders to knees. Squeeze your glutes at the top, then lower with control.',
  'Don''t hyperextend your lower back — stop when your hips are in line with your torso and knees. Drive your knees outward to keep glutes engaged.',
  ARRAY['glutes','hamstrings','core'],
  'beginner', 'none'
),
(
  'Single-Leg Glute Bridge',
  'Legs',
  'Lie on your back with one knee bent and that foot flat on the floor. Extend the other leg straight up. Drive through the planted heel to lift your hips, keeping them level, then lower.',
  'Prevent your hips from rotating — the non-working side will want to drop. Squeeze your glute hard at the top.',
  ARRAY['glutes','hamstrings','core'],
  'intermediate', 'none'
),
(
  'Donkey Kick',
  'Legs',
  'Start on all fours with hands under shoulders and knees under hips. Keeping your knee bent, drive one heel toward the ceiling until your thigh is parallel to the floor. Lower with control and repeat.',
  'Don''t rotate your hips — keep your pelvis square to the floor. Squeeze your glute at the top of each rep.',
  ARRAY['glutes','hamstrings'],
  'beginner', 'none'
),
(
  'Fire Hydrant',
  'Legs',
  'Start on all fours. Keeping your knee bent at 90°, lift one leg out to the side until your thigh is parallel to the floor, then lower. Think of a dog at a fire hydrant.',
  'Keep your core tight to prevent your torso from rotating. Move slowly and with control.',
  ARRAY['glutes','hip abductors'],
  'beginner', 'none'
),
(
  'Calf Raise',
  'Legs',
  'Stand with feet hip-width apart, toes forward. Rise up onto the balls of your feet as high as possible, hold briefly, then lower back down. For added range, let your heels drop below a step at the bottom.',
  'Do both the up and down phase slowly. For a challenge, do single-leg calf raises.',
  ARRAY['gastrocnemius','soleus'],
  'beginner', 'none'
),
(
  'Side-Lying Clamshell',
  'Legs',
  'Lie on your side with hips and knees bent at 45°, feet stacked. Keeping your feet together, rotate your top knee toward the ceiling as far as possible without rolling your pelvis back, then lower.',
  'Imagine your pelvis is fixed to the floor. This exercise specifically targets the gluteus medius — a commonly weak hip stabilizer.',
  ARRAY['glutes','hip abductors'],
  'beginner', 'none'
),
(
  'Step-Up',
  'Legs',
  'Stand in front of a step or bench. Step up with one foot, drive through that heel to fully stand on the step, then step back down. Alternate legs or complete reps on one side.',
  'Press through the heel of the working leg — don''t push off the back foot. Keep your torso upright.',
  ARRAY['quadriceps','glutes','hamstrings'],
  'beginner', 'none'
),
(
  'Box Jump',
  'Legs',
  'Stand in front of a sturdy box or platform. Load into a quarter squat, then explode upward using your arms for momentum, landing softly on the box with bent knees. Step back down, never jump down.',
  'Land softly — don''t let your knees cave. Start with a low box and build height progressively.',
  ARRAY['quadriceps','glutes','hamstrings','calves'],
  'intermediate', 'none'
),

-- ═══════════════════════════════════════════════════════════════════════
-- CORE — Bodyweight / No Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Plank',
  'Core',
  'Start face-down, resting on your forearms with elbows directly under your shoulders. Lift your body so it forms a straight line from head to heels, supported by forearms and toes. Hold for time.',
  'Don''t let your hips sag or pike up — your body should be a rigid plank. Squeeze your glutes and brace your core as if taking a punch.',
  ARRAY['core','transverse abdominis','glutes','shoulder stabilizers'],
  'beginner', 'none'
),
(
  'Side Plank',
  'Core',
  'Lie on your side and prop yourself up on one forearm with your elbow directly under your shoulder. Stack your feet or stagger them, then lift your hips off the floor to create a straight line from head to feet. Hold for time.',
  'Don''t let your hips drop toward the floor. Squeeze the obliques on the working side. Work up to balanced left-right times.',
  ARRAY['obliques','hip abductors','core'],
  'beginner', 'none'
),
(
  'Hollow Hold',
  'Core',
  'Lie on your back with arms extended overhead. Press your lower back into the floor and simultaneously lift your legs and shoulders off the floor, creating a gentle hollow banana shape. Hold for time.',
  'The lower back must stay in contact with the floor — that''s the whole exercise. Lower your arms or bend your knees to reduce the lever and make it easier.',
  ARRAY['transverse abdominis','hip flexors','core'],
  'intermediate', 'none'
),
(
  'Dead Bug',
  'Core',
  'Lie on your back with arms extended toward the ceiling and knees bent at 90° directly above your hips. Simultaneously lower your right arm overhead and extend your left leg out, keeping your lower back pressed to the floor. Return and switch sides.',
  'Your lower back must stay pressed to the floor throughout — if it arches, you''ve gone too far. Exhale as you lower the arm and leg.',
  ARRAY['transverse abdominis','core','hip flexors'],
  'beginner', 'none'
),
(
  'Bird Dog',
  'Core',
  'Start on all fours with hands under shoulders and knees under hips. Simultaneously extend your right arm forward and left leg back, keeping your spine neutral and hips level. Hold briefly, return, and switch sides.',
  'Resist the urge to rotate your hips — keep them square to the floor. Think long, not high.',
  ARRAY['erector spinae','glutes','core'],
  'beginner', 'none'
),
(
  'Mountain Climber',
  'Core',
  'Start in a high plank. Drive one knee toward your chest, then quickly switch legs in a running motion while keeping your hips low and core tight.',
  'Keep your hips level — don''t bounce them up. The faster you go, the more cardiovascular demand. Slower reps are more core-focused.',
  ARRAY['core','hip flexors','shoulders'],
  'beginner', 'none'
),
(
  'Bicycle Crunch',
  'Core',
  'Lie on your back with fingers behind your head and feet off the floor. Bring one knee toward your chest while rotating the opposite elbow toward it, fully extending the other leg. Alternate sides in a pedaling motion.',
  'Focus on rotating your thorax (ribs to pelvis), not just moving your elbow. Don''t pull on your neck.',
  ARRAY['obliques','rectus abdominis','hip flexors'],
  'beginner', 'none'
),
(
  'Leg Raise',
  'Core',
  'Lie flat on your back with legs straight and hands under your lower back or by your sides. Keeping your legs together and straight, raise them to 90° then lower slowly without letting them touch the floor.',
  'Press your lower back into the floor and exhale on the way up. If your back arches, bend your knees slightly.',
  ARRAY['hip flexors','rectus abdominis','lower core'],
  'intermediate', 'none'
),
(
  'Russian Twist',
  'Core',
  'Sit on the floor with knees bent and feet elevated slightly, leaning back about 45°. Clasp your hands together and rotate your torso from side to side, touching the floor (or a target) with your hands each rep.',
  'Rotate through your thorax, not just your arms. Keep your chest up. Add a weight or medicine ball to increase difficulty.',
  ARRAY['obliques','rectus abdominis','hip flexors'],
  'beginner', 'none'
),
(
  'Flutter Kicks',
  'Core',
  'Lie on your back with hands under your glutes and legs extended slightly off the floor. Alternate kicking your legs up and down in small, rapid movements while keeping your lower back pressed into the floor.',
  'Keep the movement controlled and legs low to increase the difficulty. Exhale slowly throughout.',
  ARRAY['hip flexors','lower core','rectus abdominis'],
  'beginner', 'none'
),
(
  'V-Up',
  'Core',
  'Lie flat on your back with arms extended overhead. Simultaneously lift your straight legs and upper body, reaching your hands toward your feet at the top to form a V shape, then lower with control.',
  'Exhale as you rise. If this is too difficult, start with bent-knee V-ups. Keep the movement smooth rather than jerky.',
  ARRAY['rectus abdominis','hip flexors','core'],
  'intermediate', 'none'
),
(
  'Hanging Knee Raise',
  'Core',
  'Hang from a pull-up bar with an overhand grip, arms fully extended. Brace your core and lift both knees toward your chest, then lower with control without swinging.',
  'Control the descent — don''t let momentum swing you. If you can''t avoid swinging, work on your grip strength first.',
  ARRAY['hip flexors','lower core','rectus abdominis'],
  'intermediate', 'minimal'
),
(
  'Ab Wheel Rollout',
  'Core',
  'Kneel on the floor holding an ab wheel with both hands. Roll the wheel forward, extending your body as far as you can while keeping your core braced and hips low, then pull back to the start.',
  'Go only as far as you can maintain a neutral spine — rolling too far causes lumbar extension, not core training. Progress from knee to standing rollouts.',
  ARRAY['core','transverse abdominis','lats','shoulders'],
  'advanced', 'minimal'
),

-- ═══════════════════════════════════════════════════════════════════════
-- CARDIO — Bodyweight / No Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Burpee',
  'Cardio',
  'From standing, drop your hands to the floor, jump or step your feet back to a plank, perform a push-up (optional), jump feet back to hands, then explosively jump up with arms overhead.',
  'Scale as needed — walk feet instead of jumping if you need lower impact. The push-up is optional. Focus on smooth transitions over raw speed.',
  ARRAY['full body','chest','shoulders','core','legs'],
  'intermediate', 'none'
),
(
  'Jumping Jack',
  'Cardio',
  'Stand with feet together and arms at sides. Jump your feet out wide while swinging your arms overhead, then jump back to the starting position.',
  'Land softly to reduce joint stress. Maintain a slightly bent knee on landing.',
  ARRAY['full body','shoulders','calves','hip abductors'],
  'beginner', 'none'
),
(
  'High Knees',
  'Cardio',
  'Run in place, driving your knees up toward your chest as high as possible with each step. Pump your arms in opposition for balance and speed.',
  'Land on the balls of your feet. Engage your core. Keep your torso upright rather than leaning back.',
  ARRAY['hip flexors','quadriceps','core','calves'],
  'beginner', 'none'
),
(
  'Bear Crawl',
  'Cardio',
  'Start on all fours with knees hovering 1–2 inches off the ground. Move forward by simultaneously advancing the right hand and left foot, then the left hand and right foot. Keep your hips low.',
  'Keep your back flat and hips level with your shoulders throughout. A common error is lifting the hips too high.',
  ARRAY['core','shoulders','quadriceps','hip flexors'],
  'intermediate', 'none'
),
(
  'Jump Rope',
  'Cardio',
  'Hold rope handles with your hands at hip height. Use your wrists to turn the rope while jumping over it with both feet landing together. Keep jumps small — just enough to clear the rope.',
  'The power comes from your wrists, not your arms. Stay on the balls of your feet. Keep your knees slightly soft to absorb impact.',
  ARRAY['calves','core','shoulders','cardiovascular system'],
  'beginner', 'minimal'
),

-- ═══════════════════════════════════════════════════════════════════════
-- FLEXIBILITY / RECOVERY — No Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Cat-Cow',
  'Flexibility',
  'Start on all fours. For Cat: exhale and round your spine toward the ceiling, tucking your chin and tailbone. For Cow: inhale and let your belly drop toward the floor while lifting your chin and tailbone. Alternate fluidly.',
  'Move with your breath — inhale for Cow, exhale for Cat. Move through your entire spine, not just your lower back.',
  ARRAY['erector spinae','core','cervical spine'],
  'beginner', 'none'
),
(
  'Child''s Pose',
  'Flexibility',
  'Kneel with knees wide and big toes touching. Sit back toward your heels and walk your hands forward, lowering your chest between your thighs. Rest your forehead on the floor and hold.',
  'Breathe into your lower back. Walk hands to one side to add a lateral stretch. Stay here for 30–90 seconds.',
  ARRAY['lats','thoracic spine','hip flexors','glutes'],
  'beginner', 'none'
),
(
  'Hip Flexor Stretch (Kneeling)',
  'Flexibility',
  'Kneel on one knee with the other foot forward, creating a 90° angle. Shift your hips forward until you feel a stretch in the front of the rear hip. Hold, then switch sides.',
  'Keep your torso upright — don''t lean forward. Tuck your tailbone slightly under to deepen the stretch.',
  ARRAY['hip flexors','iliopsoas','quadriceps'],
  'beginner', 'none'
),
(
  'Pigeon Pose',
  'Flexibility',
  'From all fours, bring one knee forward toward your wrist and extend the other leg behind you. Lower your hips toward the floor and hold the hip stretch. You can stay upright or lower your torso to the floor.',
  'This is an intense hip opener — use a folded blanket under your front hip if your hips don''t reach the floor. Breathe into the tension.',
  ARRAY['glutes','piriformis','hip external rotators'],
  'intermediate', 'none'
),
(
  'World''s Greatest Stretch',
  'Flexibility',
  'Start in a push-up position. Step your right foot outside your right hand into a lunge. Drop your left hand to the floor, rotate your right arm toward the ceiling, reaching as far as possible. Hold, then switch sides.',
  'This single stretch mobilizes your hip flexors, thoracic spine, and shoulders simultaneously. Take your time and breathe.',
  ARRAY['hip flexors','thoracic spine','glutes','shoulders'],
  'beginner', 'none'
),
(
  'Thoracic Rotation (Thread the Needle)',
  'Flexibility',
  'Start on all fours. Slide one arm under your body, following it with your shoulder and head until the shoulder touches the floor. Return and repeat. This mobilizes your upper back.',
  'The top arm can push the floor for leverage. Move slowly and hold at the end range for a breath.',
  ARRAY['thoracic spine','rotator cuff','rhomboids'],
  'beginner', 'none'
),
(
  'Doorway Chest Stretch',
  'Flexibility',
  'Stand in a doorway and place your forearms on the door frame at roughly 90°. Step one foot forward and gently lean your chest through the doorway until you feel a stretch across the front of your shoulders and chest. Hold.',
  'Don''t hyperextend your lower back — engage your core. The stretch should be felt in the chest and anterior shoulder, not the neck.',
  ARRAY['pectoralis major','anterior deltoid','biceps'],
  'beginner', 'none'
),
(
  'Downward Dog',
  'Flexibility',
  'From a push-up position, push your hips up and back, straightening your legs and pressing your heels toward the floor. Form an inverted V shape. Hold and breathe, gently walking your heels.',
  'Prioritize a long spine over straight legs — slightly bent knees are fine. Press your chest toward your thighs to open the thoracic spine.',
  ARRAY['hamstrings','calves','lats','thoracic spine','shoulders'],
  'beginner', 'none'
),

-- ═══════════════════════════════════════════════════════════════════════
-- PUSH — Minimal Equipment (Dumbbells / Bands / Bench)
-- ═══════════════════════════════════════════════════════════════════════
(
  'Dumbbell Bench Press',
  'Push',
  'Lie on a flat bench with a dumbbell in each hand at chest level, palms facing forward. Press the weights up until your arms are extended, then lower with control.',
  'Control the path — dumbbells should converge slightly at the top. Full range of motion means your elbows going slightly below bench level at the bottom.',
  ARRAY['chest','triceps','anterior deltoid'],
  'intermediate', 'minimal'
),
(
  'Dumbbell Overhead Press',
  'Push',
  'Sit or stand holding dumbbells at shoulder height, palms facing forward. Press straight up until arms are extended overhead, then lower back to the start.',
  'Keep your core tight and avoid arching your lower back. If standing, brace your abs and glutes to create a stable base.',
  ARRAY['anterior deltoid','triceps','upper trapezius'],
  'intermediate', 'minimal'
),
(
  'Dumbbell Fly',
  'Push',
  'Lie on a flat bench holding dumbbells above your chest, palms facing each other, with a slight bend in your elbows. Open your arms out to the sides in a wide arc until you feel a stretch in your chest, then squeeze the weights back together.',
  'Think hugging a tree — maintain the slight elbow bend throughout. Lower until your elbows are level with your torso.',
  ARRAY['pectoralis major','anterior deltoid'],
  'intermediate', 'minimal'
),
(
  'Dumbbell Lateral Raise',
  'Push',
  'Stand holding dumbbells at your sides. Raise both arms out to the sides until they''re parallel to the floor (forming a T), leading with your elbows. Lower with control.',
  'Tilt your pinky slightly up (as if pouring a pitcher) to target the medial deltoid. Don''t swing the weights — use a weight you can control.',
  ARRAY['medial deltoid','supraspinatus'],
  'beginner', 'minimal'
),
(
  'Dumbbell Front Raise',
  'Push',
  'Stand with dumbbells in front of your thighs, palms down. Raise one or both arms forward to shoulder height, then lower with control.',
  'Don''t use momentum — control the weight. Avoid shrugging your shoulders at the top.',
  ARRAY['anterior deltoid','upper chest'],
  'beginner', 'minimal'
),

-- ═══════════════════════════════════════════════════════════════════════
-- PULL — Minimal Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Dumbbell Row',
  'Pull',
  'Place one hand and knee on a bench for support. Hold a dumbbell in the other hand with arm extended down. Drive your elbow toward the ceiling, pulling the weight to your hip, then lower with control.',
  'Keep your back flat and parallel to the floor. Pull the elbow back, not up — think driving your elbow into your pocket.',
  ARRAY['latissimus dorsi','rhomboids','biceps','rear deltoid'],
  'beginner', 'minimal'
),
(
  'Dumbbell Bicep Curl',
  'Pull',
  'Stand holding dumbbells at your sides with palms facing forward. Curl both weights up toward your shoulders by bending your elbows, then lower with control.',
  'Keep your elbows pinned to your sides throughout. Resist swinging your torso to initiate the lift.',
  ARRAY['biceps','brachialis'],
  'beginner', 'minimal'
),
(
  'Hammer Curl',
  'Pull',
  'Hold dumbbells with a neutral grip (palms facing each other) and curl both weights up simultaneously or alternating. Lower with control.',
  'The neutral grip shifts emphasis to the brachialis and brachioradialis. Keep elbows stationary at your sides.',
  ARRAY['brachialis','biceps','brachioradialis'],
  'beginner', 'minimal'
),
(
  'Dumbbell Shrug',
  'Pull',
  'Stand holding heavy dumbbells at your sides. Elevate both shoulders as high as possible — as if shrugging — then lower with control.',
  'Don''t roll your shoulders in a circular motion — straight up and down. Pause at the top to increase tension.',
  ARRAY['upper trapezius','levator scapulae'],
  'beginner', 'minimal'
),
(
  'Band Pull-Apart',
  'Pull',
  'Hold a resistance band in front of you at shoulder height with both hands shoulder-width apart. Pull the band apart by moving your hands outward, squeezing your shoulder blades together, then return.',
  'This is an excellent posture exercise. Focus on squeezing the rear delts and rhomboids. Perform with a controlled tempo.',
  ARRAY['rear deltoid','rhomboids','middle trapezius'],
  'beginner', 'minimal'
),

-- ═══════════════════════════════════════════════════════════════════════
-- LEGS — Minimal Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Goblet Squat',
  'Legs',
  'Hold a single dumbbell or kettlebell vertically at your chest. Squat down until thighs are parallel or below, keeping the weight close to your body and chest tall, then stand back up.',
  'The counterweight helps you sit deeper and keep your torso more upright. Actively push your knees out with your elbows at the bottom.',
  ARRAY['quadriceps','glutes','core'],
  'beginner', 'minimal'
),
(
  'Dumbbell Romanian Deadlift',
  'Legs',
  'Stand holding dumbbells in front of your thighs, feet hip-width apart. Hinge at the hips, pushing them back as you lower the weights down your legs, keeping your back flat. Drive your hips forward to return to standing.',
  'Feel the stretch in your hamstrings, not your lower back. Keep the weights close to your legs. Stop at your natural hamstring flexibility — don''t round your lower back to go lower.',
  ARRAY['hamstrings','glutes','erector spinae'],
  'intermediate', 'minimal'
),
(
  'Kettlebell Swing',
  'Legs',
  'Stand behind a kettlebell with feet shoulder-width apart. Hike the bell back between your legs (hip hinge), then explosively drive your hips forward to swing the bell to shoulder height. Let gravity bring it back and hinge again.',
  'This is a hip hinge, not a squat — your back stays flat. Power comes entirely from the hip drive, not the arms. The bell should feel weightless at the top.',
  ARRAY['glutes','hamstrings','erector spinae','core'],
  'intermediate', 'minimal'
),
(
  'Dumbbell Split Squat',
  'Legs',
  'Stand in a long split stance (front foot forward, back foot behind) holding dumbbells at your sides. Lower your back knee toward the floor, keeping your front shin vertical, then drive back up.',
  'This is a stationary lunge. Keep most of your weight on the front leg. The back foot is just for balance.',
  ARRAY['quadriceps','glutes','hamstrings'],
  'intermediate', 'minimal'
),
(
  'Resistance Band Squat',
  'Legs',
  'Stand on a resistance band and hold both handles at shoulder height. Perform a squat while maintaining the band tension at your shoulders.',
  'The band adds accommodating resistance — hardest at the top where you''re strongest. Great for progressive overload without heavy weights.',
  ARRAY['quadriceps','glutes','hamstrings'],
  'beginner', 'minimal'
),

-- ═══════════════════════════════════════════════════════════════════════
-- FULL BODY — Minimal Equipment
-- ═══════════════════════════════════════════════════════════════════════
(
  'Turkish Get-Up',
  'Full Body',
  'Lie on your back holding a kettlebell extended straight up in one hand. Using a series of controlled steps (roll to elbow, high sit, kneel, stand), rise to a full standing position while keeping the bell locked out overhead. Reverse the steps to return to the floor.',
  'Move slowly and deliberately — this is a skill exercise, not a cardio move. Keep your wrist packed (neutral). Master the movement unloaded before adding weight.',
  ARRAY['core','shoulders','hips','full body'],
  'advanced', 'minimal'
),
(
  'TRX Row',
  'Pull',
  'Grip the TRX handles with palms facing each other and lean back, keeping your body straight. Pull your chest to the handles by driving your elbows back, then return to the start.',
  'The more horizontal your body, the harder the exercise. Keep elbows high and close to your torso. Squeeze your shoulder blades together at the top.',
  ARRAY['latissimus dorsi','rhomboids','biceps','rear deltoid'],
  'beginner', 'minimal'
),
(
  'TRX Push-Up',
  'Push',
  'Grip the TRX handles and set up in a push-up position with your hands in the straps. Perform a push-up while the instability of the TRX engages your stabilizers.',
  'The instability significantly increases core and shoulder stabilizer demand. Start with a shorter range of motion before going full depth.',
  ARRAY['chest','triceps','anterior deltoid','core'],
  'intermediate', 'minimal'
),

-- ═══════════════════════════════════════════════════════════════════════
-- PUSH — Gym
-- ═══════════════════════════════════════════════════════════════════════
(
  'Barbell Bench Press',
  'Push',
  'Lie on a bench with eyes under the bar. Grip the bar slightly wider than shoulder-width. Unrack and lower the bar to your lower chest, then press back to the start.',
  'Maintain a slight arch in your lower back and drive your heels into the floor for full-body tension. Tuck elbows about 45–75° from your torso.',
  ARRAY['pectoralis major','triceps','anterior deltoid'],
  'intermediate', 'gym'
),
(
  'Incline Barbell Bench Press',
  'Push',
  'Set a bench to 30–45°. Grip the bar slightly wider than shoulder-width and lower it to your upper chest, then press back up.',
  'The incline shifts emphasis to the upper chest and anterior deltoid. Keep shoulder blades retracted and depressed throughout.',
  ARRAY['upper pectoralis major','anterior deltoid','triceps'],
  'intermediate', 'gym'
),
(
  'Barbell Overhead Press',
  'Push',
  'Stand or sit with the bar at collarbone height, hands just outside shoulder-width. Press the bar overhead, moving your head back slightly to let the bar pass, then return.',
  'Keep your core braced and glutes squeezed to protect your lower back. Lock out your elbows fully at the top.',
  ARRAY['anterior deltoid','triceps','upper trapezius','core'],
  'intermediate', 'gym'
),
(
  'Chest Press Machine',
  'Push',
  'Adjust the seat so handles are at chest height. Push the handles forward until arms are extended, then return with control.',
  'A beginner-friendly way to train the chest. Adjust the seat height until the handles align with your mid-chest.',
  ARRAY['pectoralis major','triceps','anterior deltoid'],
  'beginner', 'gym'
),
(
  'Cable Chest Fly',
  'Push',
  'Set cable pulleys high. Stand between the stacks, hold one handle in each hand, and bring them together in front of your chest in a hugging arc. Return slowly.',
  'Maintain a slight elbow bend throughout. This provides constant tension at the stretched position — a key advantage over dumbbell flys.',
  ARRAY['pectoralis major','anterior deltoid'],
  'intermediate', 'gym'
),
(
  'Cable Tricep Pushdown',
  'Push',
  'Attach a rope or bar to a high cable. Stand facing the stack, grip the attachment, and push it down toward your thighs by extending your elbows. Keep your upper arms pinned at your sides.',
  'Upper arms must not move — all movement comes from the elbow joint. Lean slightly forward for better leverage.',
  ARRAY['triceps'],
  'beginner', 'gym'
),

-- ═══════════════════════════════════════════════════════════════════════
-- PULL — Gym
-- ═══════════════════════════════════════════════════════════════════════
(
  'Barbell Deadlift',
  'Pull',
  'Stand with the bar over your mid-foot, feet hip-width apart. Hinge down and grip the bar just outside your legs. Push the floor away as you drive your hips forward to stand. Lower with control.',
  'The bar should stay in contact with your legs the entire pull. Brace your core before the lift and maintain a flat back. The setup determines the lift.',
  ARRAY['hamstrings','glutes','erector spinae','latissimus dorsi','traps'],
  'intermediate', 'gym'
),
(
  'Barbell Row',
  'Pull',
  'Stand with the bar over your mid-foot. Hinge to roughly 45° with your back flat, grip the bar, and pull it to your lower chest or upper abdomen. Lower with control.',
  'Keep your torso angle consistent throughout the set — a rising torso means the weight is too heavy. Drive elbows back toward your hip pocket.',
  ARRAY['latissimus dorsi','rhomboids','biceps','rear deltoid','erector spinae'],
  'intermediate', 'gym'
),
(
  'Lat Pulldown',
  'Pull',
  'Sit at a lat pulldown station and grip the bar wider than shoulder-width. Pull the bar to your upper chest by driving your elbows down toward your hips, then return with control.',
  'Lean back slightly as you pull. Think about pulling your elbows to your hips — your hands are just hooks. Don''t pull behind your neck.',
  ARRAY['latissimus dorsi','biceps','rear deltoid'],
  'beginner', 'gym'
),
(
  'Seated Cable Row',
  'Pull',
  'Sit at a cable row station with feet on the platform and knees slightly bent. Pull the handle to your abdomen by driving your elbows back, squeezing your shoulder blades together, then return.',
  'Don''t lean far back to initiate the row — that''s using momentum. Maintain an upright torso and pull with your back.',
  ARRAY['latissimus dorsi','rhomboids','middle trapezius','biceps'],
  'beginner', 'gym'
),
(
  'Face Pull',
  'Pull',
  'Set a cable at face height with a rope attachment. Pull the ends of the rope toward your face, keeping elbows high and leading with your hands. Externally rotate your shoulders at the end of the movement.',
  'This is one of the best shoulder health exercises. Keep elbows at or above shoulder height. The external rotation at the end is key.',
  ARRAY['rear deltoid','rhomboids','external rotators','middle trapezius'],
  'beginner', 'gym'
),
(
  'Cable Curl',
  'Pull',
  'Attach a straight bar or EZ bar to a low cable. Stand facing the stack and curl the bar up toward your shoulders, keeping your elbows at your sides. Lower with control.',
  'Cables provide constant tension throughout the range of motion, unlike dumbbells. Keep your upper arms pinned at your sides.',
  ARRAY['biceps','brachialis'],
  'beginner', 'gym'
),
(
  'Preacher Curl',
  'Pull',
  'Sit at a preacher bench and place the back of your upper arms on the angled pad. Curl the bar or dumbbell up, fully extending your arms at the bottom for a complete stretch.',
  'The bench prevents you from cheating with your torso. Lower all the way for a full stretch at the bottom.',
  ARRAY['biceps','brachialis'],
  'intermediate', 'gym'
),

-- ═══════════════════════════════════════════════════════════════════════
-- LEGS — Gym
-- ═══════════════════════════════════════════════════════════════════════
(
  'Barbell Back Squat',
  'Legs',
  'Set the bar across your upper traps. Step back and set your feet shoulder-width apart, toes out. Squat down to parallel or below, keeping your chest up, then drive back up through your heels.',
  'Brace your core as if taking a punch before each rep. Keep your knees in line with your toes. The upper back must be tight to support the bar.',
  ARRAY['quadriceps','glutes','hamstrings','erector spinae'],
  'intermediate', 'gym'
),
(
  'Barbell Front Squat',
  'Legs',
  'Rest the bar across your front deltoids with elbows high and parallel to the floor. Squat to depth, maintaining an upright torso, then drive back up.',
  'The front rack position demands significant thoracic and wrist mobility. The upright torso shifts more stress to the quads.',
  ARRAY['quadriceps','glutes','core'],
  'advanced', 'gym'
),
(
  'Barbell Hip Thrust',
  'Legs',
  'Sit against a bench with a barbell across your hips, protected by a pad. Drive through your heels to thrust your hips upward, squeezing your glutes at the top until your body is flat from shoulders to knees, then lower.',
  'Chin should be tucked and eyes looking forward, not at the ceiling. Full hip extension at the top — don''t hyperextend your lower back.',
  ARRAY['glutes','hamstrings','core'],
  'intermediate', 'gym'
),
(
  'Romanian Deadlift',
  'Legs',
  'Start standing with barbell in an overhand grip. Hinge at the hips, pushing them back, and lower the bar along your legs until you feel a strong hamstring stretch (typically mid-shin). Drive hips forward to return.',
  'This is not a squat — your knees stay nearly straight (slight soft bend). Keep the bar close to your legs and your back flat throughout.',
  ARRAY['hamstrings','glutes','erector spinae'],
  'intermediate', 'gym'
),
(
  'Leg Press',
  'Legs',
  'Sit in the leg press machine with feet placed mid-platform, hip-width apart. Lower the platform toward your chest until thighs are at or past 90°, then press back to the start. Don''t lock out your knees at the top.',
  'Foot position changes the emphasis: high = more glutes/hamstrings, low = more quads. Never lock your knees — it removes tension and risks injury.',
  ARRAY['quadriceps','glutes','hamstrings'],
  'beginner', 'gym'
),
(
  'Leg Curl',
  'Legs',
  'Adjust the machine so the pad sits just above your heels. Lie face down (or sit in a seated version). Curl your heels toward your glutes against the resistance, then lower with control.',
  'Point your toes to maximize hamstring activation. Avoid letting your hips rise off the pad — that reduces the range of motion.',
  ARRAY['hamstrings','gastrocnemius'],
  'beginner', 'gym'
),
(
  'Leg Extension',
  'Legs',
  'Sit in the machine with the pad resting on your shins just above the ankle. Extend your legs to full extension, hold briefly, then lower with control.',
  'Full extension is fine for healthy knees. Lean back slightly and drive your toes toward the ceiling to maximize quad squeeze.',
  ARRAY['quadriceps'],
  'beginner', 'gym'
),
(
  'Hack Squat',
  'Legs',
  'Position yourself in the hack squat machine with shoulders under the pads and feet on the platform, slightly forward of your hips. Unlock and descend to 90° or below, then press back up.',
  'A machine-guided squat that''s easier on the lower back than a free-weight squat. Foot position changes the emphasis just like the leg press.',
  ARRAY['quadriceps','glutes','hamstrings'],
  'intermediate', 'gym'
),
(
  'Hip Adduction Machine',
  'Legs',
  'Sit in the machine with the pads on the inner sides of your knees. Bring your knees together against the resistance, then return with control.',
  'A common error is using momentum — move slowly and squeeze at the end range.',
  ARRAY['hip adductors','inner thigh'],
  'beginner', 'gym'
),
(
  'Hip Abduction Machine',
  'Legs',
  'Sit in the machine with the pads on the outer sides of your knees. Push your knees outward against the resistance, hold, then return.',
  'Great for targeting the gluteus medius and TFL. Keep your torso upright and avoid leaning to either side.',
  ARRAY['glutes','hip abductors'],
  'beginner', 'gym'
),

-- ═══════════════════════════════════════════════════════════════════════
-- CORE — Gym
-- ═══════════════════════════════════════════════════════════════════════
(
  'Cable Crunch',
  'Core',
  'Kneel in front of a high cable with a rope attachment, holding the rope behind your head. Crunch your ribs toward your hips by flexing your spine, then return with control.',
  'Don''t pull with your arms or use your hip flexors — the motion should come entirely from spinal flexion. Keep your hips in a fixed position throughout.',
  ARRAY['rectus abdominis','obliques'],
  'intermediate', 'gym'
),
(
  'Hanging Leg Raise',
  'Core',
  'Hang from a pull-up bar with straight arms. Keep your legs straight and raise them until they''re parallel to the floor (or higher), then lower with control.',
  'Anterior tilt of the pelvis at the top ensures full rectus abdominis engagement. Avoid swinging. Bent knees make this easier.',
  ARRAY['rectus abdominis','hip flexors','core'],
  'advanced', 'gym'
),

-- ═══════════════════════════════════════════════════════════════════════
-- CARDIO — Gym Machines
-- ═══════════════════════════════════════════════════════════════════════
(
  'Treadmill Running',
  'Cardio',
  'Set treadmill to desired speed and incline. Maintain an upright posture, land with a midfoot strike, and keep your gaze forward. Adjust speed and incline to control intensity.',
  'Don''t hold the handrails — this reduces the caloric cost. A 1% incline closely mimics outdoor running.',
  ARRAY['quadriceps','hamstrings','glutes','calves','cardiovascular system'],
  'beginner', 'gym'
),
(
  'Stationary Bike (Cycling)',
  'Cardio',
  'Adjust the seat so your leg has a slight bend at the bottom of each pedal stroke. Pedal at a steady cadence, using resistance to control intensity. Keep a soft grip on the handlebars.',
  'For a sprint interval, increase resistance and cadence simultaneously. For endurance, lower resistance and maintain a steady 80–100 RPM.',
  ARRAY['quadriceps','hamstrings','glutes','cardiovascular system'],
  'beginner', 'gym'
),
(
  'Rowing Machine (Erg)',
  'Cardio',
  'Sit with feet strapped in and grab the handle. Drive with your legs first, then lean back slightly and pull the handle to your lower sternum with elbows tucking in. Reverse the motion to return.',
  '60% of the power should come from your legs, 20% from your back lean, 20% from your arms. The catch position has arms extended, shins vertical.',
  ARRAY['hamstrings','glutes','erector spinae','latissimus dorsi','biceps','cardiovascular system'],
  'beginner', 'gym'
),
(
  'Stair Climber',
  'Cardio',
  'Step onto the machine and hold the handrails lightly for balance. Step in a natural stair-climbing motion, keeping your weight over your feet — don''t lean onto the rails.',
  'Leaning heavily on the rails dramatically reduces the exercise benefit. Take full steps rather than small shuffles to work through a fuller range of motion.',
  ARRAY['glutes','quadriceps','hamstrings','calves','cardiovascular system'],
  'beginner', 'gym'
),
(
  'Elliptical',
  'Cardio',
  'Step onto the elliptical, hold the moving handles, and push and pull with your arms while driving the pedals in an elliptical path. Adjust resistance and incline to control intensity.',
  'The elliptical has zero impact — ideal for joint-sensitive training. Reverse the direction to emphasize hamstrings and glutes.',
  ARRAY['quadriceps','hamstrings','glutes','cardiovascular system'],
  'beginner', 'gym'
);

COMMIT;
