// lib/seo/json-ld.ts
// Typed factory functions for JSON-LD structured data.
// Inject into pages via:
//   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return raw ? `https://${raw.replace(/^https?:\/\//, '')}` : 'https://centenarianos.com';
}

// ─── Organization ─────────────────────────────────────────────────────────────

export function organizationSchema() {
  const SITE_URL = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CentenarianOS',
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description: 'Multi-decade personal operating system for executing audacious goals through data-driven daily habits.',
    sameAs: [],
  };
}

// ─── Person (public profile) ──────────────────────────────────────────────────

interface ProfileData {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export function personSchema(profile: ProfileData) {
  const SITE_URL = getSiteUrl();
  const name = profile.display_name || profile.username;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url: `${SITE_URL}/profiles/${profile.username}`,
    description: profile.bio ?? undefined,
    image: profile.avatar_url ?? undefined,
    memberOf: organizationSchema(),
  };
}

// ─── Course (academy) ─────────────────────────────────────────────────────────

interface CourseData {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  instructor_name?: string | null;
}

export function courseSchema(course: CourseData) {
  const SITE_URL = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description ?? undefined,
    url: `${SITE_URL}/academy/${course.id}`,
    image: course.cover_image_url ?? undefined,
    provider: organizationSchema(),
    hasCourseInstance: [
      {
        '@type': 'CourseInstance',
        courseMode: 'online',
        instructor: course.instructor_name
          ? { '@type': 'Person', name: course.instructor_name }
          : undefined,
      },
    ],
  };
}

// ─── BlogPosting ──────────────────────────────────────────────────────────────

interface BlogPostData {
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  updated_at?: string | null;
  slug: string;
  username: string;
  author_name: string;
  author_avatar?: string | null;
}

export function articleSchema(post: BlogPostData) {
  const SITE_URL = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.cover_image_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? post.published_at ?? undefined,
    url: `${SITE_URL}/blog/${post.username}/${post.slug}`,
    author: {
      '@type': 'Person',
      name: post.author_name,
      url: `${SITE_URL}/profiles/${post.username}`,
      image: post.author_avatar ?? undefined,
    },
    publisher: organizationSchema(),
  };
}

// ─── Recipe ───────────────────────────────────────────────────────────────────

interface RecipeData {
  title: string;
  description: string | null;
  cover_image_url: string | null;
  slug: string;
  username: string;
  author_name: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  published_at: string | null;
}

export function recipeSchema(recipe: RecipeData) {
  const SITE_URL = getSiteUrl();
  const totalMinutes = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.description ?? undefined,
    image: recipe.cover_image_url ?? undefined,
    url: `${SITE_URL}/recipes/cooks/${recipe.username}/${recipe.slug}`,
    author: {
      '@type': 'Person',
      name: recipe.author_name,
      url: `${SITE_URL}/profiles/${recipe.username}`,
    },
    publisher: organizationSchema(),
    datePublished: recipe.published_at ?? undefined,
    prepTime: recipe.prep_time_minutes ? `PT${recipe.prep_time_minutes}M` : undefined,
    cookTime: recipe.cook_time_minutes ? `PT${recipe.cook_time_minutes}M` : undefined,
    totalTime: totalMinutes > 0 ? `PT${totalMinutes}M` : undefined,
    recipeYield: recipe.servings ? `${recipe.servings} servings` : undefined,
  };
}

// ─── Certificate (EducationalOccupationalCredential) ──────────────────────────

interface CertData {
  achievementId: string;
  subjectTitle: string;
  recipientName: string;
  username: string;
  earnedAt: string;
}

export function certificateSchema(data: CertData) {
  const SITE_URL = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalCredential',
    name: `Certificate of Completion: ${data.subjectTitle}`,
    description: `${data.recipientName} successfully completed "${data.subjectTitle}" on CentenarianOS.`,
    url: `${SITE_URL}/certificates/${data.achievementId}`,
    credentialCategory: 'certificate',
    recognizedBy: organizationSchema(),
    educationalLevel: 'Professional',
    dateCreated: data.earnedAt,
    about: {
      '@type': 'Course',
      name: data.subjectTitle,
      provider: organizationSchema(),
    },
    holder: {
      '@type': 'Person',
      name: data.recipientName,
      url: `${SITE_URL}/profiles/${data.username}`,
    },
  };
}

// ─── Exercise (HowTo) ─────────────────────────────────────────────────────────

interface ExerciseData {
  id: string;
  name: string;
  instructions?: string | null;
  primary_muscles?: string[] | null;
  difficulty?: string | null;
  video_url?: string | null;
}

export function exerciseSchema(exercise: ExerciseData) {
  const SITE_URL = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: exercise.name,
    description: exercise.instructions ?? undefined,
    url: `${SITE_URL}/exercises/${exercise.id}`,
    ...(exercise.video_url
      ? { video: { '@type': 'VideoObject', contentUrl: exercise.video_url } }
      : {}),
    ...(exercise.difficulty ? { educationalLevel: exercise.difficulty } : {}),
    tool:
      exercise.primary_muscles?.map((m) => ({ '@type': 'HowToTool', name: m })) ?? [],
    publisher: organizationSchema(),
  };
}

// ─── Workout Template (ExercisePlan) ──────────────────────────────────────────

interface WorkoutTemplateData {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  estimated_duration_min?: number | null;
}

export function workoutTemplateSchema(wt: WorkoutTemplateData) {
  const SITE_URL = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'ExercisePlan',
    name: wt.name,
    description: wt.description ?? undefined,
    url: `${SITE_URL}/workouts`,
    ...(wt.estimated_duration_min
      ? { timeRequired: `PT${wt.estimated_duration_min}M` }
      : {}),
    ...(wt.category ? { activityType: wt.category } : {}),
    provider: organizationSchema(),
  };
}

// ─── BreadcrumbList ──────────────────────────────────────────────────────────

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ─── Product + Offer (pricing) ────────────────────────────────────────────────

interface PricingTier {
  name: string;
  description: string;
  price: number;
  priceCurrency?: string;
  billingPeriod?: string;
}

export function productSchema(tier: PricingTier) {
  const SITE_URL = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `CentenarianOS — ${tier.name}`,
    description: tier.description,
    brand: { '@type': 'Brand', name: 'CentenarianOS' },
    offers: {
      '@type': 'Offer',
      price: tier.price,
      priceCurrency: tier.priceCurrency ?? 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
      ...(tier.billingPeriod ? { billingIncrement: tier.billingPeriod } : {}),
    },
  };
}
