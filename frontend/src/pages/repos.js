const Timeless = window.Timeless;

function ReposPageView() {
  return View(
    {
      class: "content-page repos-page page",
      attributes: { n: "repos-page" },
    },
    [
      Timeless.Webview({
        class: "repos-frame",
        href: "http://127.0.0.1:2030/repos",
        attributes: {
          n: "repos-frame",
          title: "目录",
          referrerpolicy: "no-referrer",
        },
      }),
    ],
  );
}

export default ReposPageView;
