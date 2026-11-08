// 会话/账户路由共用布局。原先套的是 Creem 模板的黑底终端壳
// （"Creem Template Dashboard v1.0.0" + tmux 风格导航），账户体系未启用后
// 属于模板残留。现在只做纯净透传，页面自身负责完整内容与主题。
export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
