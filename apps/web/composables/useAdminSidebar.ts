export function useAdminSidebar() {
  const open = useState('admin-sidebar-open', () => false);

  function toggle() {
    open.value = !open.value;
  }

  function close() {
    open.value = false;
  }

  return { open, toggle, close };
}
