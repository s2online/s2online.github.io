var swf = document.querySelector('#scratch embed');

window.gotZipBase64 = function(content) {
	swf.ASopenProjectFromData(content);
	setTimeout(() => {
		$('#downloader').animate({height: 0}, 1000);
	}, 100);
};

if (JSwillDownload()) {
	document.body.classList.add('download');
	startDownload(location.hash.slice(1));
}
