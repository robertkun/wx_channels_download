const Timeless = window.Timeless;

function TasksPageView() {
  return View(
    {
      class: "content-page tasks-page page",
      attributes: { n: "tasks-page" },
    },
    [
      Timeless.Webview({
        class: "tasks-frame",
        href: "/console/",
        attributes: {
          n: "tasks-frame",
          title: "任务",
          referrerpolicy: "no-referrer",
        },
      }),
    ],
  );
}

export default TasksPageView;
