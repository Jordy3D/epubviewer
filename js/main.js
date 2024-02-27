
// an epub object class to handle the epub file
class EPUB {
    constructor(file) {
        this.file = file;
        this.zip = new JSZip();
        this.toc = [];
        this.content = [];
        this.styles = [];
        this.images = [];

        this.rootFolder = "";
    }

    async load() {
        const potentialRootFolders = ["OEBPS", "OPS", "EPUB", ""];

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
        this.content = await this.getContent();
        this.styles = await this.getStyles();
        this.images = await this.getImages();
    }

    async getToc() {
        let tocFile = null;
        if (this.rootFolder === "")
            tocFile = await this.zip.file("toc.ncx").async("string");
        else
            tocFile = await this.zip.file(this.rootFolder + "/toc.ncx").async("string");

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

    async getContent() {
        let content = [];
        for (let i = 0; i < this.toc.length; i++) {
            let item = this.toc[i];

            let html = null;
            if (this.rootFolder === "")
                html = await this.zip.file(item.content).async("string");
            else
                html = await this.zip.file(this.rootFolder + "/" + item.content).async("string");

            content.push(html);
        }
        return content;
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

var epub = null;
var chapter = 0;

function displayToc() {
    let toc = document.getElementById("epub-toc");
    let content = document.getElementById("epub-content");
    for (let i = 0; i < epub.toc.length; i++) {
        let item = epub.toc[i];
        let link = document.createElement("a");
        link.textContent = item.text;
        link.href = "";
        link.onclick = function () {
            content.innerHTML = epub.content[i];
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

    return content;
}

function loadChapter(index) {
    let content = replaceContent(epub.content[index]);
    document.getElementById("epub-content").innerHTML = content;

    markActiveLink();
}

function markActiveLink() {
    let links = document.getElementById("epub-toc").getElementsByTagName("a");
    for (let i = 0; i < links.length; i++)
        links[i].classList.remove("active");
    links[chapter].classList.add("active");
}

function reset() {
    document.getElementById("epub-toc").innerHTML = "";
    document.getElementById("epub-content").innerHTML = "";

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
        // print the object to the console
        console.log(epub);

        // display the table of contents
        displayToc();

        // display the first chapter
        loadChapter(0, true);

        // enable the next and previous buttons
        enableButtons();
    });
});

function enableButtons() {
    console.log("enabling buttons");
    document.getElementById("prev").disabled = false;
    document.getElementById("next").disabled = false;
}

// when the user clicks on a link in the table of contents, display the chapter
document.getElementById("epub-toc").addEventListener("click", function (event) {
    // cancel the default action of the link
    event.preventDefault();

    if (event.target.tagName === "A") {
        let index = Array.from(event.target.parentNode.children).indexOf(event.target);
        loadChapter(index);
        chapter = index;
    }
});

// when the user clicks on the next chapter button, display the next chapter
document.getElementById("next").addEventListener("click", function (event) {
    if (chapter < epub.content.length - 1) {
        chapter++;
        loadChapter(chapter);
    }
});

// when the user clicks on the previous chapter button, display the previous chapter
document.getElementById("prev").addEventListener("click", function (event) {
    if (chapter > 0) {
        chapter--;
        loadChapter(chapter);
    }
});

// on mouse scroll
document.addEventListener("wheel", function (event) {
    // 1 is up, -1 is down
    // get the direction the user is scrolling
    var scrollDirection = 0;
    if (event.deltaY < 0)
        scrollDirection = 1;
    else
        scrollDirection = -1;

    console.log("scroll direction: " + scrollDirection);

    // if there is no scroll bar 
    if (document.documentElement.scrollHeight === document.documentElement.clientHeight)
    {
        console.log("no scroll bar");

        // if the user is scrolling up
        if (scrollDirection === 1 && chapter > 0)
        {
            chapter--;
            loadChapter(chapter);
        }
        // if the user is scrolling down
        else if (scrollDirection === -1 && chapter < epub.content.length - 1)
        {
            chapter++;
            loadChapter(chapter);
        }
    }
    else
    {
        console.log("scroll bar");

        let scrollHeight = document.documentElement.scrollHeight;
        let clientHeight = document.documentElement.clientHeight;
        let scrollY = window.scrollY;

        let bottom = (scrollHeight - clientHeight - scrollY);
        let atBottom = bottom <= 1;
        console.log(`bottom: ${bottom}, atBottom: ${atBottom}`);

        // if the user is scrolling up
        if (scrollDirection === 1 && window.scrollY === 0 && chapter > 0)
        {
            chapter--;
            loadChapter(chapter);

            // scroll to the bottom
            window.scrollTo(0, document.documentElement.scrollHeight);
        }
        // if the user is scrolling down
        else if (scrollDirection === -1 && atBottom && chapter < epub.content.length - 1)
        {
            chapter++;
            loadChapter(chapter);

            // scroll to the top
            window.scrollTo(0, 0);
        }
    }
});