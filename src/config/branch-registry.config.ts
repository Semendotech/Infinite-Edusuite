export interface BranchRegistryEntry {
  id: string;
  name: string;
  code: string;
  isMainCampus: boolean;
  status: 'active' | 'inactive';
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export const defaultBranchCode = 'KSM';

export const branchRegistry: BranchRegistryEntry[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Kisumu Campus',
    code: 'KSM',
    isMainCampus: true,
    status: 'active',
    city: 'Kisumu',
    address: '123 Main Street, Kisumu',
    phone: '+254700000001',
    email: 'kisumu@infiniteedusuite.com',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Nakuru Campus',
    code: 'NAK',
    isMainCampus: false,
    status: 'active',
    city: 'Nakuru',
    address: '45 Campus Road, Nakuru',
    phone: '+254700000002',
    email: 'nakuru@infiniteedusuite.com',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Eldoret Campus',
    code: 'ELD',
    isMainCampus: false,
    status: 'active',
    city: 'Eldoret',
    address: '8 University Avenue, Eldoret',
    phone: '+254700000003',
    email: 'eldoret@infiniteedusuite.com',
  },
];

export function getBranchRegistryByCode(code: string) {
  return branchRegistry.find((branch) => branch.code === code) ?? null;
}

export function getBranchRegistryById(id: string) {
  return branchRegistry.find((branch) => branch.id === id) ?? null;
}

export function getDefaultBranchRegistryEntry() {
  return getBranchRegistryByCode(defaultBranchCode)!;
}
