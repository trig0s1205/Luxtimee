export function useAuth() {
  const auth = useAuthStore();
  const config = useRuntimeConfig();

  const loginWithGoogle = () => {
    window.location.href = `${config.public.apiBaseUrl}/auth/google`;
  };

  return {
    auth,
    loginWithGoogle,
    fetchMe: () => auth.fetchMe(),
    logout: () => auth.logout(),
    mockLogin: (email: string, name: string) => auth.mockLogin(email, name),
  };
}
