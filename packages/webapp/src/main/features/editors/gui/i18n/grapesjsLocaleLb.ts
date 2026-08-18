/**
 * Luxembourgish (lb) locale pack for GrapesJS's own UI chrome.
 *
 * GrapesJS ships built-in locale packs for de/fr/es/ca (imported from
 * `grapesjs/locale/*` in GraphicalUIEditor.tsx), but NOT for `lb`. Without this
 * pack, every GrapesJS-native string — panel button titles, the Trait/Settings
 * panel label, selector & style managers, device names — falls back to English
 * when the editor language is Luxembourgish, so the "Settings" panel title stayed
 * English in lb regardless of the diagram.
 *
 * The structure mirrors `grapesjs/locale/en.js`. Where a concept already has a
 * Luxembourgish translation elsewhere in the app (the sidebar tooltips and Style
 * Manager sectors in `editors.gui.*`), the same wording is reused here for
 * consistency (e.g. the Trait/Settings panel title reuses "Eegeschaften",
 * matching the sidebar "Traits" tooltip).
 *
 * DRAFT: all Luxembourgish strings are machine-drafted and pending native-speaker
 * review before the multilingual branch merges.
 */
const traitInputAttr = {
  placeholder: 'z.B. Text hei',
};

const grapesjsLocaleLb = {
  assetManager: {
    addButton: 'Bild bäisetzen',
    inputPlh: 'http://path/to/the/image.jpg',
    modalTitle: 'Bild auswielen',
    uploadTitle: 'Dateien hei erofzéien oder klicken fir eropzelueden',
  },
  blockManager: {
    labels: {},
    categories: {},
  },
  domComponents: {
    names: {
      '': 'Këscht',
      wrapper: 'Kierper',
      text: 'Text',
      comment: 'Kommentar',
      image: 'Bild',
      video: 'Video',
      label: 'Etikett',
      link: 'Link',
      map: 'Kaart',
      tfoot: 'Table-Fouss',
      tbody: 'Table-Kierper',
      thead: 'Table-Kapp',
      table: 'Tabell',
      row: 'Table-Reih',
      cell: 'Table-Zell',
    },
  },
  deviceManager: {
    device: 'Apparat',
    devices: {
      desktop: 'Desktop',
      tablet: 'Tablet',
      mobileLandscape: 'Mobil (Queesch)',
      mobilePortrait: 'Mobil (Héich)',
    },
  },
  panels: {
    buttons: {
      titles: {
        preview: 'Virschau',
        fullscreen: 'Vollbild',
        'sw-visibility': 'Komponenten uweisen',
        'export-template': 'Code uweisen',
        'open-sm': 'Stiler',
        'open-tm': 'Eegeschaften',
        'open-layers': 'Schichten',
        'open-blocks': 'Bléck',
      },
    },
  },
  selectorManager: {
    label: 'Klassen',
    selected: 'Ausgewielt',
    emptyState: '- Zoustand -',
    states: {
      hover: 'Hover',
      active: 'Klick',
      'nth-of-type(2n)': 'Grad/Ongrad',
    },
  },
  styleManager: {
    empty: 'Wielt en Element aus, ier Dir de Style Manager benotzt',
    layer: 'Schicht',
    fileButton: 'Biller',
    sectors: {
      general: 'Allgemeng',
      layout: 'Layout',
      typography: 'Typografie',
      decorations: 'Dekoratiounen',
      extra: 'Extra',
      flex: 'Flex',
      dimension: 'Dimensioun',
    },
    properties: {
      'text-shadow-h': 'X',
      'text-shadow-v': 'Y',
      'text-shadow-blur': 'Onschäerft',
      'text-shadow-color': 'Faarf',
      'box-shadow-h': 'X',
      'box-shadow-v': 'Y',
      'box-shadow-blur': 'Onschäerft',
      'box-shadow-spread': 'Verdeelung',
      'box-shadow-color': 'Faarf',
      'box-shadow-type': 'Typ',
      'margin-top-sub': 'Uewen',
      'margin-right-sub': 'Riets',
      'margin-bottom-sub': 'Ënnen',
      'margin-left-sub': 'Lénks',
      'padding-top-sub': 'Uewen',
      'padding-right-sub': 'Riets',
      'padding-bottom-sub': 'Ënnen',
      'padding-left-sub': 'Lénks',
      'border-width-sub': 'Breet',
      'border-style-sub': 'Stil',
      'border-color-sub': 'Faarf',
      'border-top-left-radius-sub': 'Uewen Lénks',
      'border-top-right-radius-sub': 'Uewen Riets',
      'border-bottom-right-radius-sub': 'Ënnen Riets',
      'border-bottom-left-radius-sub': 'Ënnen Lénks',
      'transform-rotate-x': 'Dréinen X',
      'transform-rotate-y': 'Dréinen Y',
      'transform-rotate-z': 'Dréinen Z',
      'transform-scale-x': 'Skala X',
      'transform-scale-y': 'Skala Y',
      'transform-scale-z': 'Skala Z',
      'transition-property-sub': 'Eegeschaft',
      'transition-duration-sub': 'Dauer',
      'transition-timing-function-sub': 'Timing',
      'background-image-sub': 'Bild',
      'background-repeat-sub': 'Widderhuelen',
      'background-position-sub': 'Positioun',
      'background-attachment-sub': 'Uschloss',
      'background-size-sub': 'Gréisst',
    },
  },
  traitManager: {
    empty: 'Wielt en Element aus, ier Dir den Trait Manager benotzt',
    label: 'Eegeschaften',
    categories: {},
    traits: {
      labels: {},
      attributes: {
        id: traitInputAttr,
        alt: traitInputAttr,
        title: traitInputAttr,
        href: {
          placeholder: 'z.B. https://google.com',
        },
      },
      options: {
        target: {
          false: 'Dëst Fënster',
          _blank: 'Neit Fënster',
        },
      },
    },
  },
  storageManager: {
    recover: 'Wëllt Dir déi net gespäichert Ännerungen zréckhuelen?',
  },
};

export default grapesjsLocaleLb;
