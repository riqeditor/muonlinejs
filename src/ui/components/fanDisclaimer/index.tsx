import './style.less';

/**
 * Aviso obrigatório do projeto thegame: projeto de fã, sem fins lucrativos
 * e sem vínculo com a Webzen. Deve aparecer na tela inicial e na tela de login.
 */
export const FanDisclaimer = () => {
  return (
    <p className="fan-disclaimer">
      <strong>thegame</strong> é um projeto de fã, sem fins lucrativos e sem
      vínculo com a Webzen. MU Online é marca registrada da Webzen Inc.
    </p>
  );
};
