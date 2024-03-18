const indent = document.getElementById("indent");
const spacing = document.getElementById("spacing");
const justify = document.getElementById("justify");
const lineHeight = document.getElementById("lineHeight");
const font = document.getElementById("font");
const fontSize = document.getElementById("fontSize");
const textColour = document.getElementById("textColour");
const backgroundColour = document.getElementById("backgroundColour");

const defaultButton = document.getElementById("default");

defaultButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    defaultValues();
    saveValuesToStorage();
});

var settings = {
    indent: 1,
    spacing: 5,
    justify: true,
    lineHeight: 1.25,
    font: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    fontSize: 16,
    textColour: "#ffffff",
    backgroundColour: "#333333",
};

loadValuesFromStorage();
defineListeners();

// properties
function setProperty(name, value) {
    document.documentElement.style.setProperty(name, value);
}

function setProperties() {
    console.log("Setting properties...");

    setProperty("--paragraphIndent", `${settings.indent}em`);
    setProperty("--paragraphSpacing", `${settings.spacing}px`);
    setProperty("--paragraphJustify", settings.justify ? "justify" : "initial");
    setProperty("--paragraphLineHeight", settings.lineHeight);

    setProperty("--paragraphFont", settings.font);
    setProperty("--paragraphFontSize", `${settings.fontSize}px`);

    setProperty("--paragraphColor", settings.textColour);
    setProperty("--backgroundColour", settings.backgroundColour);
}

function getProperty(name) {
    let value = getComputedStyle(document.documentElement).getPropertyValue(name);

    // if the value contains , then it's a list of values
    if (value.includes(","))
        value = value.split(",");

    return value;
}

// storage
function saveValuesToStorage() {
    console.log("Saving values to storage...");

    localStorage.setItem("indent", settings.indent);
    localStorage.setItem("spacing", settings.spacing);
    localStorage.setItem("justify", settings.justify);
    localStorage.setItem("lineHeight", settings.lineHeight);
    
    localStorage.setItem("font", settings.font);
    localStorage.setItem("fontSize", settings.fontSize);
    
    localStorage.setItem("textColour", settings.textColour);
    localStorage.setItem("backgroundColour", settings.backgroundColour);
}

function loadValuesFromStorage() {
    console.log("Loading values from storage...");

    settings.indent = localStorage.getItem("indent");
    settings.spacing = localStorage.getItem("spacing");
    settings.justify = localStorage.getItem("justify");
    settings.lineHeight = localStorage.getItem("lineHeight");
    
    settings.font = localStorage.getItem("font");
    settings.fontSize = localStorage.getItem("fontSize");
    
    settings.textColour = localStorage.getItem("textColour");
    settings.backgroundColour = localStorage.getItem("backgroundColour");

    setSettings();
}

// settings
function setSettings() {
    console.log("Setting settings...");

    indent.value = settings.indent;
    spacing.value = settings.spacing;
    justify.checked = settings.justify;
    lineHeight.value = settings.lineHeight;

    font.value = settings.font;
    fontSize.value = settings.fontSize;

    textColour.value = settings.textColour;
    backgroundColour.value = settings.backgroundColour;

    setProperties();
}

function defaultValues() {
    console.log("Setting default values...");

    settings.indent = 1;
    settings.spacing = 5;
    settings.justify = true;
    settings.lineHeight = 1.25;

    settings.font = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
    settings.fontSize = 16;

    settings.textColour = "#ffffff";
    settings.backgroundColour = "#333333";

    setSettings();
    setProperties();
}

// listeners
function ignoreDefault(e) {
    e.preventDefault();
    e.stopPropagation();
}

function defineListeners() {
    indent.addEventListener("input", (e) => {
        ignoreDefault(e);
        setProperty("--paragraphIndent", `${e.target.value}em`);
    });

    spacing.addEventListener("input", (e) => {
        ignoreDefault(e);
        setProperty("--paragraphSpacing", `${e.target.value}px`);
    });

    justify.addEventListener("input", (e) => {
        ignoreDefault(e);
        setProperty(
            "--paragraphJustify",
            e.target.checked ? "justify" : "initial"
        );
    });

    lineHeight.addEventListener("input", (e) => {
        ignoreDefault(e);
        setProperty("--paragraphLineHeight", e.target.value);
    });

    font.addEventListener("input", (e) => {
        ignoreDefault(e);
        setProperty("--paragraphFont", e.target.value);
    });

    fontSize.addEventListener("input", (e) => {
        ignoreDefault(e);
        setProperty("--paragraphFontSize", `${e.target.value}px`);
    });

    textColour.addEventListener("input", (e) => {
        ignoreDefault(e);
        setProperty("--paragraphColour", e.target.value);
    });

    backgroundColour.addEventListener("input", (e) => {
        ignoreDefault(e);
        setProperty("--backgroundColour", e.target.value);
    });
}
