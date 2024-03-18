



// an epub object class to handle the epub file
class EPUB {
    constructor(file) {
        this.file = file;
        this.zip = new JSZip();
        this.toc = [];
        this.tocContent = [];
        this.content = [];
        this.styles = [];
        this.images = [];

        this.rootFolder = "";
    }

    async load() {
        const potentialRootFolders = ["OEBPS", "OPS", "EPUB", "ops", ""];

        // unzip the epub file, only the content in the OEBPS folder is needed
        this.zip = await this.zip.loadAsync(this.file);

        // check for potential root folders by trying to access folder/toc.ncx
        for (let i = 0; i < potentialRootFolders.length; i++) {
            // try to access the toc.ncx file in the potential root folder
            let folder = this.zip.folder(potentialRootFolders[i]);
            if (folder !== null && folder.file("toc.ncx") !== null) {
                this.rootFolder = potentialRootFolders[i];
                break;
            }
        }

        this.toc = await this.getToc();
        this.tocContent = await this.getTocContent();
        this.content = await this.getContent();

        this.mergedContent = this.mergeContent();

        this.styles = await this.getStyles();
        this.images = await this.getImages();
    }

    async getToc() {
        let path = "toc.ncx"
        if (this.rootFolder != "")
            path = this.rootFolder + "/" + path;

        let tocFile = await this.zip.file(path).async("string");

        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(tocFile, "text/xml");
        let navPoints = xmlDoc.getElementsByTagName("navPoint");
        let toc = [];
        for (let i = 0; i < navPoints.length; i++) {
            let navPoint = navPoints[i];
            let text = navPoint.getElementsByTagName("text")[0].textContent;
            let content = navPoint.getElementsByTagName("content")[0].getAttribute("src");
            toc.push({ text: text, content: content });
        }
        return toc;
    }

    async getTocContent() {
        let content = [];
        if (this.toc.length === 0) return content;

        for (let i = 0; i < this.toc.length; i++) {
            let item = this.toc[i];

            let path = item.content;
            if (this.rootFolder != "")
                path = this.rootFolder + "/" + path;

            path = path.split("#")[0];
            let html = await this.zip.file(path).async("string");

            // save the file name as the key and the content as the value
            let name = item.content.split("/").pop();
            name = name.split(".")[0];
            content.push({ name: name, content: html });
        }
        return content;
    }

    async getContent() {
        // load content from content.opf's manifest
        // only the html/xhtml files are needed
        let content = [];
        let path = "content.opf";

        if (this.rootFolder != "")
            path = this.rootFolder + "/" + path;

        // if there is an opf file that is not called content.opf, use that
        let opfFiles = this.zip.filter(function (relativePath, file) {
            return relativePath.endsWith(".opf");
        });
        if (opfFiles.length > 0) {
            path = opfFiles[0].name;
        }

        let contentFile = await this.zip.file(path).async("string");

        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(contentFile, "text/xml");
        let manifest = xmlDoc.getElementsByTagName("manifest")[0];
        let items = manifest.getElementsByTagName("item");
        for (let i = 0; i < items.length; i++) {
            let item = items[i];

            // only get the html/xhtml files
            if (!item.getAttribute("href").endsWith(".html") && !item.getAttribute("href").endsWith(".xhtml"))
                continue;

            let href = item.getAttribute("href");
            let html = null;
            if (this.rootFolder === "")
                html = await this.zip.file(href).async("string");
            else
                html = await this.zip.file(this.rootFolder + "/" + href).async("string");

            // save the file name as the key and the content as the value
            let name = href.split("/").pop();
            name = name.split(".")[0];
            content.push({ name: name, content: html });
        }
        return content;
    }


    mergeContent() {
        let mergedContent = [];

        // make a copy of each array
        let tempTocContent = this.tocContent.slice();
        let tempContent = this.content.slice();

        // go through the content array and add in the content from the content array between the tocContent where the .name matches
        // ie, tocContent has chapter1, chapter2, chapter3, and content has chapter1, insert1, chapter1_1, chapter2, insert2, chapter2_1, chapter3
        // the mergedContent array should be chapter1, insert1, chapter1_1, chapter2, insert2, chapter2_1, chapter3
        let index = 0;
        for (let i = 0; i < tempContent.length; i++) {
            let name = tempContent[i].name;
            // if the name exists in the tocContent array, add it to the mergedContent array in the last position
            // if the name doesn't exist in the tocContent array, add it to the mergedContent array in the current position
            let found = false;
            for (let j = 0; j < tempTocContent.length; j++) {
                if (tempTocContent[j].name === name) {
                    mergedContent.push(tempTocContent[j]);
                    tempTocContent.splice(j, 1);
                    found = true;
                    break;
                }
            }
            if (!found) {
                mergedContent.push(tempContent[i]);
            }
        }


        // add the remaining content from the tocContent array to the end of the mergedContent array
        for (let i = 0; i < tempTocContent.length; i++) {
            mergedContent.push(tempTocContent[i]);
        }

        // TODO: merge the mergedContent array such that split chapters are merged together

        return mergedContent;
    }


    async getStyles() {
        // load the css files and store them in a dictionary with the file name as the key
        let styles = [];
        let styleFiles = this.zip.filter(function (relativePath, file) {
            return relativePath.endsWith(".css");
        });
        for (let i = 0; i < styleFiles.length; i++) {
            let style = styleFiles[i];
            let css = await style.async("string");
            let name = style.name;
            // remove the path from the style name and just store the file name
            name = name.split("/").pop();
            // remove the .css extension
            name = name.split(".")[0];

            // save the CSS as a blob
            styles[name] = URL.createObjectURL(new Blob([css], { type: "text/css" }));
        }
        return styles;
    }

    async getImages() {
        // load images as blobs, and store them in a dictionary with the image name as the key
        let images = [];
        let imageFiles = this.zip.filter(function (relativePath, file) {
            return relativePath.endsWith(".jpg") || relativePath.endsWith(".jpeg") || relativePath.endsWith(".png");
        });
        for (let i = 0; i < imageFiles.length; i++) {
            let image = imageFiles[i];
            let blob = new Blob([await image.async("uint8array")], { type: "image/jpeg" });
            let name = image.name;
            // remove the path from the image name and just store the file name
            name = name.split("/").pop();
            images[name] = URL.createObjectURL(blob);
        }
        return images;
    }
}

// global variables
const epubContent = document.getElementById("epub-content");

var epub = null;
var chapter = 0;

function displayToc() {
    let toc = document.getElementById("epub-toc");
    let content = epubContent;
    for (let i = 0; i < epub.toc.length; i++) {
        let item = epub.toc[i];
        let link = document.createElement("a");
        link.textContent = item.text;
        link.href = "";
        link.onclick = function () {
            content.innerHTML = epub.tocContent[i];
        };
        toc.appendChild(link);
    }
}

function replaceContent(content) {
    // replace the images with the blob urls
    // an img tag looks like this: 
    //     <img alt="Cover" class="cover" src="../Images/Cover.jpg">
    // we want to replace the src attribute with the blob url
    let imgPattern = /<img[^>]*>/g;
    content = content.replace(imgPattern, function (match) {
        let src = match.match(/src="([^"]*)"/)[1];
        let imageName = src.split("/").pop();
        let imageSrc = epub.images[imageName];
        return match.replace(src, imageSrc);
    });

    // the style element looks like this:
    // <link href="../Styles/stylesheet.css" rel="stylesheet" type="text/css">
    // only affect links with the rel="stylesheet" attribute
    let stylePattern = /<link[^>]*>/g;
    content = content.replace(stylePattern, function (match) {
        let href = match.match(/href="([^"]*)"/)[1];
        let styleName = href.split("/").pop().split(".")[0];
        let styleSrc = epub.styles[styleName];
        return match.replace(href, styleSrc);
    });


    // go through every a on the page and add an onclick event go to that chapter if the href is a chapter
    let aPattern = /<a[^>]*>/g;
    content = content.replace(aPattern, function (match) {
        // if the href starts with http, it's an external link, so don't do anything
        if (match.includes("http")) return match;

        let href = match.match(/href="([^"]*)"/)[1];
        let chapter = epub.mergedContent.findIndex(x => x.name === href.split("/").pop().split(".")[0]);
        if (chapter !== -1) {
            // remove the href and add the onlick event
            match = match.replace(/href="([^"]*)"/, "");
            match = match.replace(">", `href onclick="loadChapter(${chapter}, true); return false;">`);
        }
        return match;
    });

    return content;
}

function loadChapter(index, tocPage = false) {
    let content = replaceContent(epub.mergedContent[index].content);
    epubContent.innerHTML = content;

    if (tocPage) {
        // set index
        chapter = index;
    }

    markActiveLink();
}

function markActiveLink() {
    let links = document.getElementById("epub-toc").getElementsByTagName("a");
    for (let i = 0; i < links.length; i++)
        links[i].classList.remove("active");

    // get the active index
    let content = epub.mergedContent[chapter].content;
    let activeIndex = epub.tocContent.findIndex(x => x.content === content);

    if (activeIndex !== -1) // if the active index is found, mark the link as active
        links[activeIndex].classList.add("active");
}

function reset() {
    document.getElementById("epub-toc").innerHTML = "";
    epubContent.innerHTML = "";

    // reset the chapter counter
    chapter = 0;
}


// EVENT HANDLERS

// handle the file upload
document.getElementById("file").addEventListener("change", async function (event) {
    // clear things out
    reset();

    let file = event.target.files[0];
    epub = new EPUB(file);
    await epub.load().then(() => {
        console.log(epub);                  // print the epub object to the console

        displayToc();                       // display the table of contents
        loadChapter(0, true);               // load the first chapter
        enableButtons();                    // enable the next and previous buttons
    }).catch((e) => {
        // set the error message in the content div

        // if the file extension is not .epub, display an error message
        let error = "Invalid file type. Please upload an epub file.";
        if (file.name.split(".").pop() === "epub")
            error = "An error occurred while trying to load the epub file.<br>It may be structured differently than expected.";

        let content = epubContent;
        let errorContent = `<h1>Error</h1><p>${error}</p>`;
        content.innerHTML = errorContent;

        console.error(e);
    });
});

function enableButtons() {
    document.getElementById("prev").disabled = false;
    document.getElementById("next").disabled = false;
}

function scrollToTop() {
    window.scrollTo(0, 0);
}
function scrollToBottom() {
    window.scrollTo(0, document.documentElement.scrollHeight);
}

// when the user clicks on a link in the table of contents, display the chapter
document.getElementById("epub-toc").addEventListener("click", function (event) {
    // cancel the default action of the link
    event.preventDefault();

    if (event.target.tagName === "A") {

        // find the element of mergedContent that matches the clicked link
        let tocIndex = Array.from(event.target.parentNode.children).indexOf(event.target);

        // find the index of the clicked link in the mergedContent array by the name
        let index = epub.mergedContent.findIndex(x => x.name === epub.toc[tocIndex].content.split("/").pop().split(".")[0]);

        chapter = index;
        loadChapter(index);

        // scroll to the top
        scrollToTop();
    }
});

// when the user clicks on the next chapter button, display the next chapter
document.getElementById("next").addEventListener("click", function (event) {
    if (chapter < epub.mergedContent.length - 1) {
        chapter++;
        loadChapter(chapter);
        scrollToTop();
    }
});

// when the user clicks on the previous chapter button, display the previous chapter
document.getElementById("prev").addEventListener("click", function (event) {
    if (chapter > 0) {
        chapter--;
        loadChapter(chapter);
        scrollToTop();
    }
});

// on mouse scroll
epubContent.addEventListener("wheel", function (event) {
    // if there is no epub file, do nothing
    if (epub === null)
        return;

    // 1 is up, -1 is down
    var scrollDirection = event.deltaY < 0 ? 1 : -1;

    let scrollHeight = document.documentElement.scrollHeight;
    let clientHeight = document.documentElement.clientHeight;
    var hasScrollBar = scrollHeight !== clientHeight;

    if (!hasScrollBar) {        // if there is no scroll bar, just change the chapter
        if (scrollDirection === 1 && chapter > 0) {
            chapter--;
            loadChapter(chapter);
            scrollToBottom();
        }
        else if (scrollDirection === -1 && chapter < epub.mergedContent.length - 1) {
            chapter++;
            loadChapter(chapter);
            scrollToTop();
        }
    }
    else {                      // if there is a scroll bar, check if the user is at the top or bottom 
        let scrollY = window.scrollY;

        let bottom = (scrollHeight - clientHeight - scrollY);
        let atBottom = bottom <= 1;

        if (scrollDirection === 1 && window.scrollY === 0 && chapter > 0) {
            chapter--;
            loadChapter(chapter);
            scrollToBottom();
        }
        else if (scrollDirection === -1 && atBottom && chapter < epub.mergedContent.length - 1) {
            chapter++;
            loadChapter(chapter);
            scrollToTop();
        }
    }
});

// clear the file input when the user clicks on the clear button
document.getElementById("clear").addEventListener("click", function (event) {
    document.getElementById("file").value = "";
    reset();
});