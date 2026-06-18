import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { handbookSections, suggestedPrompts } from "./schema";

type SectionSeed = {
  sectionPath: string;
  title: string;
  content: string;
  keywords: string[];
  sensitivity: "safe" | "policy_escalate" | "handoff";
};

const SECTIONS: SectionSeed[] = [
  {
    sectionPath: "Daily Operations > Hours & Daily Schedule",
    title: "Hours & Daily Schedule",
    content:
      "We're open Monday through Friday from 7:00 AM to 6:00 PM. We're closed on weekends and on the holidays listed in Closures & Holidays. A typical day starts with arrival and free play from 7:00 to 8:30, then breakfast, circle time, and learning centers in the morning. Lunch is at 11:30, followed by nap or rest from 12:30 to 2:30 and afternoon activities until pickup. Drop-off is open the whole morning, but we recommend arriving by 9:00 so your child doesn't miss circle time.",
    keywords: [
      "hours", "time", "open", "close", "closing", "opening",
      "schedule", "daily", "drop off", "drop-off", "dropoff", "dropping off",
      "pickup", "pick up", "pick-up", "picking up",
      "morning", "afternoon", "monday", "weekday", "weekend",
    ],
    sensitivity: "safe",
  },
  {
    sectionPath: "Daily Operations > Arrival & Departure",
    title: "Arrival & Departure",
    content:
      "Every child needs to be signed in and out by an adult on your authorized pickup list (anyone 18 or older with photo ID). We'll ask for ID the first few times and any time a new person is on the list. Please walk your child to their classroom. Staff can't accept hand-offs at the door because we have to confirm who's coming and going. If you forgot something or need to add someone to the pickup list, talk to the front desk. We can't take updates by text.",
    keywords: [
      "arrival", "arrive", "departure", "leave", "leaving",
      "sign in", "signing in", "sign out", "signing out", "signin", "signout",
      "id", "identification", "photo id",
      "authorized", "authorize", "pickup list", "pick up list",
      "adult", "who can pick up", "drop off", "dropoff",
    ],
    sensitivity: "safe",
  },
  {
    sectionPath: "Daily Operations > Late Pickup & Fees",
    title: "Late Pickup & Fees",
    content:
      "Our day ends at 6:00 PM. If you're running late, please call us. We'd much rather know than worry. A late fee of $1 per minute applies after 6:00, billed in five-minute blocks and added to your next invoice. After three late pickups in a single month, we'll schedule a quick conversation to figure out what would help, because consistent pickup matters for your child's routine and our team's day.",
    keywords: [
      "late", "late pickup", "late pick up", "late pick-up",
      "after hours", "after 6", "after six",
      "fee", "fees", "charge", "charges", "cost", "extra",
      "overtime", "what happens if i'm late", "running late",
    ],
    sensitivity: "safe",
  },
  {
    sectionPath: "Daily Operations > Closures & Holidays",
    title: "Closures & Holidays",
    content:
      "We're closed on the following holidays this year: Memorial Day (May 25), Independence Day (July 3 observed), Labor Day (September 7), Veterans Day (November 11), Thanksgiving and the day after (November 26 and 27), and Christmas Eve through New Year's Day (December 24 through January 1). For snow days, we follow the Canyons School District schedule, so if they close or delay, we do too. We'll also send a notice through the app the night before whenever possible.",
    keywords: [
      "closed", "closing", "closure", "closures", "holiday", "holidays",
      "veterans day", "memorial day", "labor day", "independence day",
      "thanksgiving", "christmas", "new year", "new years", "fourth of july",
      "snow day", "snow", "weather", "delay", "delayed",
      "are you open", "will you be open", "open today",
    ],
    sensitivity: "safe",
  },
  {
    sectionPath: "Daily Operations > Communication & Daily Sheets",
    title: "Communication & Daily Sheets",
    content:
      "We use the brightwheel app for almost everything: daily sheets, photos, sign-in/out, and messaging your child's teacher directly. Daily sheets go out every afternoon with meals, naps, diaper changes, and activities. For anything urgent like illness, custody changes, or pickup permission, please call the front desk at (801) 555-0142 instead of messaging, so we can act on it right away. We try to reply to non-urgent messages within one business day.",
    keywords: [
      "daily sheet", "daily sheets", "report", "reports",
      "app", "brightwheel", "message", "messages", "messaging",
      "communication", "communicate", "contact", "reach you",
      "phone", "call", "text", "email",
      "who do i talk to", "front desk",
    ],
    sensitivity: "safe",
  },
  {
    sectionPath: "Enrollment & Tuition > Tuition & Fees",
    title: "Tuition & Fees",
    content:
      "Tuition is billed monthly and due on the first of the month. Our current rates are: Infants (6 weeks to 12 months) $1,720 a month, Toddlers (12 to 24 months) $1,495 a month, Preschool (2 to 4 years) $1,325 a month, and Pre-K (4 to 5 years) $1,235 a month. A one-time $150 registration fee applies at enrollment, and there's a $50 supply fee each fall. We don't pro-rate for absences or vacation, because you're paying to hold the spot. For questions about financial assistance or payment plans, please reach out to our enrollment team.",
    keywords: [
      "tuition", "cost", "price", "pricing", "fee", "fees", "pay", "payment",
      "monthly", "per month", "how much",
      "infant", "infants", "baby", "babies",
      "toddler", "toddlers",
      "preschool", "pre-school", "pre school",
      "pre-k", "prek", "pre k",
      "registration fee", "supply fee",
    ],
    sensitivity: "safe",
  },
  {
    sectionPath: "Enrollment & Tuition > Tours & Enrollment",
    title: "Tours & Enrollment",
    content:
      "We love showing families around. Tours are Tuesdays and Thursdays at 10:00 AM and 2:00 PM, and they take about 30 minutes. You'll see classrooms, meet teachers, and have time for questions. Email tours@maplegrovelearning.com or call (801) 555-0142 to book one. After a tour, you'll get an enrollment packet. Once it's returned with the registration fee, we'll confirm your child's start date based on age-group availability. Most of our age groups have a short waitlist, so earlier is better.",
    keywords: [
      "tour", "tours", "visit", "visiting", "see the school", "look around",
      "enroll", "enrollment", "enrolling", "register", "registration", "sign up",
      "waitlist", "wait list", "openings", "spots", "spot available",
      "schedule", "book", "appointment",
    ],
    sensitivity: "safe",
  },
  {
    sectionPath: "Health & Safety > Illness & Fever Policy",
    title: "Illness & Fever Policy",
    content:
      "We want every child to be comfortable and to keep illness from spreading. Please keep your child home if they have a fever of 100.4°F or higher, vomiting or diarrhea in the last 24 hours, a continuous cough, pink eye symptoms, an undiagnosed rash, or have started antibiotics less than 24 hours ago. Children can return when they've been fever-free for 24 hours without medication and other symptoms have resolved. Our staff can't decide whether your specific child should come in. That's a conversation for you and your pediatrician. If you're unsure, please call us.",
    keywords: [
      "sick", "ill", "illness", "unwell", "not feeling well",
      "fever", "temperature", "100.4", "hot", "feverish",
      "cough", "coughing",
      "vomit", "vomiting", "throw up", "threw up", "puking",
      "diarrhea",
      "pink eye", "pinkeye", "conjunctivitis",
      "rash", "spots",
      "antibiotic", "antibiotics",
      "stay home", "send home", "can my child come",
      "return", "come back", "when can my child come back",
    ],
    sensitivity: "policy_escalate",
  },
  {
    sectionPath: "Health & Safety > Medication Administration",
    title: "Medication Administration",
    content:
      "We can give medication during the day with a signed permission form, the original labeled container, and clear dosing instructions. The form needs to list the child's name, the medication, the dose, and the times. Teachers administer all medication and log each dose, never parents leaving a bottle in a cubby. We don't give cough drops because of the choking hazard, and we don't recommend dosages or substitute medications. If your child has a condition that needs specialized administration like an EpiPen, an inhaler, or a diabetes plan, we'll set up training with you before the first day.",
    keywords: [
      "medication", "medicine", "medicines", "meds", "give medicine",
      "tylenol", "ibuprofen", "advil", "motrin",
      "prescription", "prescribed",
      "dose", "dosage", "doses",
      "epi pen", "epipen", "inhaler", "asthma", "diabetes",
      "cough drop", "cough drops",
      "permission form", "medication form",
    ],
    sensitivity: "policy_escalate",
  },
  {
    sectionPath: "Health & Safety > Allergies & Special Diets",
    title: "Allergies & Special Diets",
    content:
      "We're a peanut and tree-nut free center, and we accommodate most other food allergies and dietary restrictions with documentation from your child's doctor. At enrollment, you'll fill out a food and allergy plan we keep in the classroom. We label every child's food and water bottle, and we don't allow shared snacks from home unless they're on a pre-approved class list. For severe allergies that require an EpiPen, we'll train staff on your child's plan before they start. Please let us know if anything changes, even a new diagnosis we should watch for.",
    keywords: [
      "allergy", "allergies", "allergic", "allergic reaction",
      "peanut", "peanuts", "tree nut", "nut",
      "dairy", "milk", "lactose",
      "gluten", "wheat", "celiac",
      "egg", "eggs", "soy", "shellfish",
      "epi pen", "epipen",
      "diet", "dietary", "special diet", "vegetarian", "vegan",
      "food", "what can my child eat",
    ],
    sensitivity: "policy_escalate",
  },
  {
    sectionPath: "Family Partnership > Custody & Authorized Pickups",
    title: "Custody & Authorized Pickups",
    content:
      "We follow whatever is on file in your enrollment paperwork and any court order you've given us. The enrolling parent is our primary contact, and we only release a child to people on your written pickup list. We can't act on verbal updates, texts, or in-the-moment changes, so please update your pickup list at the front desk so we have it in writing. If there's a custody dispute, a restraining order, or a parenting plan change, please bring the documentation in and we'll make sure our records match.",
    keywords: [
      "custody", "custody arrangement",
      "divorce", "divorced", "separated", "separation",
      "court order", "court", "parenting plan",
      "restraining order",
      "pickup list", "pick up list", "authorized",
      "stepparent", "step parent", "step-parent",
      "guardian", "legal guardian",
      "who can pick up my child", "permission to pick up",
    ],
    sensitivity: "handoff",
  },
  {
    sectionPath: "Daily Care > Lunch & Nutrition",
    title: "Lunch & Nutrition",
    content:
      "We serve a hot lunch and two snacks every day, all included in tuition. This week's lunch menu: Monday is turkey and cheese wraps with carrot sticks and milk. Tuesday is whole-wheat pasta with marinara, peas, and milk. Wednesday is baked chicken nuggets, roasted sweet potatoes, and milk. Thursday is cheese quesadillas with black beans and milk. Friday is mini pancakes with turkey sausage and fruit. Morning snack is fruit and crackers, and afternoon snack is a cheese or yogurt option. Menus rotate every two weeks and accommodate documented allergies.",
    keywords: [
      "lunch", "lunches", "menu", "food", "meal", "meals",
      "hot lunch", "what's for lunch", "what is for lunch",
      "snack", "snacks", "morning snack", "afternoon snack",
      "today's lunch", "today",
      "breakfast", "milk",
      "pack lunch", "bring lunch", "forgot lunch",
    ],
    sensitivity: "safe",
  },
  {
    sectionPath: "Daily Care > What to Bring",
    title: "What to Bring",
    content:
      "On day one, send your child with a change of clothes (two for infants and toddlers), a labeled water bottle, weather-appropriate outerwear, and any comfort item they nap with. Infants and toddlers need diapers, wipes, and a crib sheet labeled with their name. We keep sunscreen and bug spray on hand and apply it with your written permission. Please label everything: name on the tag, bottom of the shoe, side of the bottle. Lost and found lives in the front hallway and we empty it monthly.",
    keywords: [
      "bring", "what to bring", "what should i bring", "what should i pack",
      "first day", "day one", "starting", "new",
      "change of clothes", "extra clothes",
      "diaper", "diapers", "wipes",
      "nap mat", "blanket", "crib sheet",
      "sunscreen", "bug spray", "sun screen",
      "water bottle", "bottle",
      "shoes", "weather", "coat", "jacket",
      "label", "labeled", "name",
    ],
    sensitivity: "safe",
  },
];

const PROMPTS: { text: string; sortOrder: number }[] = [
  { text: "Are you open on Veterans Day?", sortOrder: 10 },
  { text: "What's tuition for infants?", sortOrder: 20 },
  { text: "My child has a fever, can they come in?", sortOrder: 30 },
  { text: "What time does drop-off end?", sortOrder: 40 },
  { text: "What should I pack on my toddler's first day?", sortOrder: 50 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const db = drizzle(sql);

  console.log(`Seeding ${SECTIONS.length} handbook sections...`);
  // Idempotent: clear handbookSections then insert. queryLog references it
  // with ON DELETE SET NULL so this is safe.
  await db.delete(handbookSections);
  for (const s of SECTIONS) {
    await db.insert(handbookSections).values(s);
    console.log(`  + ${s.sectionPath}`);
  }

  console.log(`Seeding ${PROMPTS.length} suggested prompts...`);
  await db.delete(suggestedPrompts);
  for (const p of PROMPTS) {
    await db.insert(suggestedPrompts).values(p);
    console.log(`  + ${p.text}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
