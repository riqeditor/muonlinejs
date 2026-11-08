import './style.less';
import { observer } from 'mobx-react-lite';
import { Store, UIState } from '../../../store';
import { useEventBus } from '../../../hooks/useEventBus';
import {
  LoginResponseLoginResultEnum,
  LoginResponsePacket,
} from '../../../common/packets/ServerToClientPackets';
import { MAX_PASSWORD_LENGTH, MAX_USERNAME_LENGTH } from '../../../consts';
import { TitleBackground, TitleFooter, TitleLogo } from '../../components/titleScreen';

const Result = LoginResponseLoginResultEnum;

/** Mensagens em português para cada resposta de login do servidor (C1 F1 01). */
const LOGIN_ERROR_MESSAGES: Partial<Record<LoginResponseLoginResultEnum, string>> = {
  [Result.InvalidPassword]: 'Usuário ou senha incorretos.',
  [Result.AccountInvalid]: 'Esta conta não existe.',
  [Result.AccountAlreadyConnected]: 'Esta conta já está conectada.',
  [Result.ServerIsFull]: 'O servidor está cheio. Tente novamente mais tarde.',
  [Result.AccountBlocked]: 'Esta conta está bloqueada.',
  [Result.WrongVersion]: 'Versão do cliente incompatível com o servidor.',
  [Result.ConnectionError]: 'Erro de conexão com o servidor.',
  [Result.ConnectionClosed3Fails]:
    'Conexão encerrada após 3 tentativas erradas. Recarregue a página.',
  [Result.TemporaryBlocked]: 'Esta conta está bloqueada temporariamente.',
};

function loginErrorMessage(result: LoginResponseLoginResultEnum): string {
  return (
    LOGIN_ERROR_MESSAGES[result] ??
    `Não foi possível entrar (código ${result}).`
  );
}

export const LoginPage = observer(() => {
  useEventBus('LoginResponse', async bytes => {
    Store.loginProcessing = false;

    const p = new LoginResponsePacket(bytes);

    if (p.Success === Result.Okay) {
      Store.loginError = undefined;
      Store.saveLoginData();
      await Store.disconnectFromConnectServer();
      Store.uiState = UIState.Characters;
      return;
    }

    Store.loginError = loginErrorMessage(p.Success);
  });

  const canSubmit =
    !Store.loginProcessing &&
    Store.username.trim().length > 0 &&
    Store.password.length > 0;

  const onLoginClicked = () => {
    if (!canSubmit) return;

    Store.loginError = undefined;
    Store.loginProcessing = true;

    Store.loginRequest(Store.username.trim(), Store.password);
  };

  return (
    <div className="login-page title-page">
      <TitleBackground />
      <TitleLogo />
      <form
        className="login-panel mu-window"
        onSubmit={e => {
          e.preventDefault();
          onLoginClicked();
        }}
      >
        <h2>Conectar</h2>

        <label>
          <span>Conta</span>
          <input
            type="text"
            autoComplete="username"
            autoFocus
            value={Store.username}
            onChange={e => {
              Store.username = e.target.value;
            }}
            maxLength={MAX_USERNAME_LENGTH}
          />
        </label>

        <label>
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            value={Store.password}
            onChange={e => {
              Store.password = e.target.value;
            }}
            maxLength={MAX_PASSWORD_LENGTH}
          />
        </label>

        <p className="login-hint">
          Conta e senha: até {MAX_USERNAME_LENGTH} caracteres cada.
        </p>

        {!!Store.loginError && (
          <p className="login-error" role="alert">
            {Store.loginError}
          </p>
        )}

        <button type="submit" className="mu-button" disabled={!canSubmit}>
          {Store.loginProcessing ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <TitleFooter />
    </div>
  );
});
