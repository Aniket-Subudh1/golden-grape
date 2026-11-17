import { ClipboardList, Home, PackageCheck, PackagePlus, ScanBarcode, ShoppingBag, Tally5, Users } from 'lucide-react';

/** One icon per staff screen: the tab bar, the sidebar and the home's quick actions. Plain data (server and client). */
export const ICONS = {
  home: Home,
  scan: ScanBarcode,
  sale: ShoppingBag,
  orders: ClipboardList,
  receive: PackageCheck,
  count: Tally5,
  customers: Users,
  reorder: PackagePlus,
} as const;
