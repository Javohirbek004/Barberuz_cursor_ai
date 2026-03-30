export type Segment = "regular" | "new" | "lost";

export interface MockClient {
  id: string;
  name: string;
  phone: string;
  lastVisit: string;
  visitCount: number;
  segment: Segment;
  barber: string;
  notes: string;
  bookingHistory: { date: string; service: string; price: string }[];
}

export const MOCK_CLIENTS: MockClient[] = [
  {
    id: "mock-1",
    name: "Aziz Mahmudov",
    phone: "+998 90 123 45 67",
    lastVisit: "23-mart",
    visitCount: 7,
    segment: "regular",
    barber: "Sardor",
    notes: "Qisqa soch, soqol ham qilib berish yoqtiradi.",
    bookingHistory: [
      { date: "23-mart", service: "Fade + Soqol", price: "60 000" },
      { date: "5-mart",  service: "Fade",          price: "45 000" },
      { date: "14-fevral", service: "Kompleks",    price: "80 000" },
    ],
  },
  {
    id: "mock-2",
    name: "Jamshid Komilov",
    phone: "+998 91 777 00 11",
    lastVisit: "Kecha",
    visitCount: 1,
    segment: "new",
    barber: "Jasur",
    notes: "",
    bookingHistory: [
      { date: "Kecha", service: "Soch olish", price: "35 000" },
    ],
  },
  {
    id: "mock-3",
    name: "Ali Valiyev",
    phone: "+998 93 444 55 66",
    lastVisit: "40 kun oldin",
    visitCount: 3,
    segment: "lost",
    barber: "Ali",
    notes: "Ko'pincha dam olish kunlari keladi.",
    bookingHistory: [
      { date: "12-fevral",  service: "Soch olish",       price: "35 000" },
      { date: "20-yanvar",  service: "Soqol tekislash",   price: "25 000" },
      { date: "3-yanvar",   service: "Soch olish",        price: "35 000" },
    ],
  },
];

export const SEGMENT_META: Record<Segment, { emoji: string; label: string; color: string; bg: string }> = {
  regular: { emoji: "🔥", label: "Doimiy",    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  new:     { emoji: "✨", label: "Yangi",     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  lost:    { emoji: "⚠️", label: "Yo'qolgan", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
};
