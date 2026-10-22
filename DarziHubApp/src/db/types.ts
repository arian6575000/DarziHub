export type Status = 'new' | 'cutting' | 'stitching' | 'ready' | 'delivered' | 'cancelled';
export const STATUSES: Status[] = ['new', 'cutting', 'stitching', 'ready', 'delivered', 'cancelled'];
export const FLOW: Status[] = ['new', 'cutting', 'stitching', 'ready', 'delivered'];
export const PENDING: Status[] = ['new', 'cutting', 'stitching', 'ready'];
export const EXPENSE_CATS = ['cloth', 'notions', 'rent', 'bills', 'helper', 'transport', 'other'] as const;
export const STOCK_UNITS = ['meter', 'yard', 'piece', 'spool', 'box'] as const;
export const STOCK_CATS = ['fabric', 'thread', 'button', 'lining', 'other'] as const;

export type Gender = 'gents' | 'ladies' | 'both';
export type MeasurementMap = Record<string, { values: Record<string, string | number>; style: string; updatedAt?: number }>;

export interface Customer {
  id: number;
  name: string;
  phone: string;
  gender: Gender;
  address: string;
  notes: string;
  headId: number | null;
  createdAt: number;
  measurements?: MeasurementMap;
}

export interface OrderItem {
  garment: string;
  qty: number;
  rate: number;
  fabricAmount: number;
  notes: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  status: Status;
  orderDate: string;
  deliveryDate: string;
  trialDate: string;
  urgent: boolean;
  discount: number;
  notes: string;
  fabricReceived: string;
  fabricMeters: number;
  measurements: MeasurementMap; // snapshot taken when the order was saved
  deliveredAt: string;
  createdAt: number;
  updatedAt: number;
  items: OrderItem[];
  photos: string[]; // file names inside the app's photo folder
}

export interface Payment {
  id: number;
  customerId: number;
  orderId: number | null;
  amount: number;
  date: string;
  method: 'cash' | 'online';
  note: string;
  createdAt: number;
}

export interface Expense { id: number; date: string; category: string; amount: number; note: string; createdAt: number }
export interface StockItem { id: number; name: string; category: string; unit: string; qty: number; minQty: number; createdAt: number }
export interface StockLog { id: number; stockId: number; date: string; delta: number; note: string; createdAt: number }
export interface CashDay { date: string; opening: number; closing: number | null }

export interface Settings {
  shopName: string;
  shopNameUr: string;
  ownerName: string;
  phone: string;
  address: string;
  logo: string | null;
  currency: string;
  countryCode: string;
  orderPrefix: string;
  language: 'ur' | 'en';
  receiptFormat: 'thermal80' | 'thermal58' | 'a4';
  footerEn: string;
  footerUr: string;
  rates: Record<string, number>;
  notifyEnabled: boolean;
  lastBackupAt: number;
  readyMsgEn: string;
  readyMsgUr: string;
  dueMsgEn: string;
  dueMsgUr: string;
}

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'My Tailor Shop',
  shopNameUr: 'میری ٹیلرنگ شاپ',
  ownerName: '',
  phone: '',
  address: '',
  logo: null,
  currency: 'Rs',
  countryCode: '92',
  orderPrefix: 'ORD',
  language: 'ur',
  receiptFormat: 'thermal80',
  footerEn: 'Thank you! Please bring this slip at delivery.',
  footerUr: 'شکریہ! ڈیلیوری کے وقت یہ پرچی ساتھ لائیں۔',
  rates: {},
  notifyEnabled: false,
  lastBackupAt: 0,
  readyMsgEn: 'Assalam o Alaikum {name}, your order {order} is ready for pickup at {shop}. Balance due: {balance}. Thank you!',
  readyMsgUr: 'السلام علیکم {name}، آپ کا آرڈر {order} تیار ہے، {shop} سے وصول کر لیں۔ باقی رقم: {balance}۔ شکریہ!',
  dueMsgEn: 'Assalam o Alaikum {name}, a gentle reminder: your balance of {balance} at {shop} is pending. Thank you!',
  dueMsgUr: 'السلام علیکم {name}، یاد دہانی: {shop} کی طرف آپ کی {balance} رقم باقی ہے۔ شکریہ!',
};

export interface CustomerSummary { billed: number; paid: number; balance: number; orderCount: number }
