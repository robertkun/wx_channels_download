import {
  DownloadV2RemakePanel,
  DownloadV2ReverseDialog,
  DownloadV2WhiteModelDialog,
} from "./downloadv2.components.js";
import { DownloadV2Model } from "./downloadv2.model.js";

function remake_query_from_props(props) {
  const from_view = (props && props.view && props.view.query) || {};
  let params = null;
  try {
    params = new URLSearchParams(window.location.search || "");
  } catch (_error) {
    params = new URLSearchParams();
  }
  return {
    id: String(from_view.id || params.get("id") || "").trim(),
    path: String(from_view.path || params.get("path") || "").trim(),
    title: String(from_view.title || params.get("title") || "").trim(),
    pageLabel: "视频复刻",
    showReverse: false,
    showStoryboard: false,
  };
}

function RemakePageView(props) {
  const page_props = props || {};
  const vm$ = DownloadV2Model({
    ...page_props,
    downloader: window.dl$,
  });

  return View(
    {
      class: "content-page dl-page-remake-page page",
      attributes: { n: "remake-page" },
      onMounted() {
        const query = remake_query_from_props(page_props);
        Promise.resolve(vm$.methods.ready()).finally(() => {
          vm$.methods.bootRemakeFromQuery(query);
        });
      },
      onUnmounted() {
        vm$.methods.clean();
      },
    },
    [
      DownloadV2RemakePanel({
        store: vm$,
        class: "dl-page-remake-page-panel",
        name: "remake-page-panel",
        pageLabel: "视频复刻",
        showReverse: false,
        showStoryboard: false,
      }),
      DownloadV2WhiteModelDialog({ store: vm$ }),
    ],
  );
}

export default RemakePageView;
