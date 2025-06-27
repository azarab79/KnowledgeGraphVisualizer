export const ICON_MAP = {
  System:  'system-svgrepo-com.svg',
  Database:'database-svgrepo-com.svg',
  Storage: 'database-svgrepo-com.svg',
  Trading: 'finance-department-trader-trading-cfo-svgrepo-com.svg',
  Finance: 'finance-svgrepo-com.svg',
  User:    'user-alt-1-svgrepo-com.svg',
  Trader:  'user-alt-1-svgrepo-com.svg',
  Process: 'workflow-svgrepo-com.svg',
  Workflow:'workflow-svgrepo-com.svg',
  Dashboard:'business-connection-connect-communication-teamwork-people-svgrepo-com.svg'
};
export const DEFAULT_ICON = 'system-svgrepo-com.svg';

export const getNodeIcon = label =>
  ICON_MAP[label] || DEFAULT_ICON; 