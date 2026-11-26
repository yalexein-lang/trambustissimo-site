if (location.protocol === "http:" || location.protocol === "https:") {
  for (const player of document.querySelectorAll(".product-player[data-youtube-id]")) {
    const launch = player.querySelector(".product-video-launch");
    launch.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();

      const frame = document.createElement("iframe");
      frame.src = `https://www.youtube-nocookie.com/embed/${player.dataset.youtubeId}?autoplay=1`;
      frame.title = player.dataset.videoTitle;
      frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      player.replaceChildren(frame);
      frame.focus();
    });
  }
}
