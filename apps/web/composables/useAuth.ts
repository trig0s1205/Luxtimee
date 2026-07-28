import type { AuthConfigDto, AuthUserDto } from '@luxtime/shared';
import {
  consumeAuthRedirect,
  resolvePostLoginRedirect,
  storeAuthRedirect,
} from '~/utils/auth-redirect';

export function useAuth() {
  const auth = useAuthStore();
  const config = useRuntimeConfig();
  const api = useApi();

  const loginWithGoogle = (redirect?: string) => {
    if (redirect) storeAuthRedirect(redirect);
    window.location.href = `${config.public.apiBaseUrl}/auth/google`;
  };

  const mockLogin = async (email: string, name: string) => {
    const user = await auth.mockLogin(email.trim(), name.trim());
    return user;
  };

  const completeLogin = async (requested?: string | null) => {
    await auth.fetchMe();
    if (!auth.user) return null;
    const stored = consumeAuthRedirect();
    const destination = resolvePostLoginRedirect(auth.user, requested ?? stored);
    await navigateTo(destination);
    return destination;
  };

  const fetchAuthConfig = () => api.get<AuthConfigDto>('/auth/config');

  const redirectAfterLogin = (user: AuthUserDto, requested?: string | null) =>
    resolvePostLoginRedirect(user, requested ?? consumeAuthRedirect());

  const localLogin = (email: string, password: string) => auth.localLogin(email, password);

  const credentialLogin = (email: string, password: string) => auth.credentialLogin(email, password);

  return {
    auth,
    loginWithGoogle,
    mockLogin,
    localLogin,
    credentialLogin,
    completeLogin,
    fetchAuthConfig,
    redirectAfterLogin,
    fetchMe: () => auth.fetchMe(),
    logout: () => auth.logout(),
  };
}
