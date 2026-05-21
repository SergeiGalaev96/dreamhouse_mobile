export const ROLE_IDS = {
  admin: 1,
  director: 2,
  accountant: 6,
  supplier: 13,
  salesManager: 16
};

export const SALES_ACCESS_ROLE_IDS = [
  ROLE_IDS.admin,
  ROLE_IDS.director,
  ROLE_IDS.accountant,
  ROLE_IDS.salesManager
];

export const canAccessSales = (user) => SALES_ACCESS_ROLE_IDS.includes(Number(user?.role_id));

export const getHomePath = (user) => {
  const roleId = Number(user?.role_id);

  if (roleId === ROLE_IDS.salesManager) return "/sales";
  if (roleId === ROLE_IDS.supplier) return "/dashboard";

  return "/projects";
};
