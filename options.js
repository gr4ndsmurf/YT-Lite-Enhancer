// Default settings
const defaultSettings = {
  keySlow: 's',
  valSlow: 0.1,
  keyFast: 'd',
  valFast: 0.1,
  keyReset: 'r',
  keyWindowed: 'w' // New setting
};

// Load settings when page loads
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(defaultSettings, (items) => {
    document.getElementById('keySlow').value = items.keySlow;
    document.getElementById('valSlow').value = items.valSlow;
    document.getElementById('keyFast').value = items.keyFast;
    document.getElementById('valFast').value = items.valFast;
    document.getElementById('keyReset').value = items.keyReset;
    document.getElementById('keyWindowed').value = items.keyWindowed; // New
  });
});

// When save button is clicked
document.getElementById('save').addEventListener('click', () => {
  const settings = {
    keySlow: document.getElementById('keySlow').value.toLowerCase(),
    valSlow: parseFloat(document.getElementById('valSlow').value),
    keyFast: document.getElementById('keyFast').value.toLowerCase(),
    valFast: parseFloat(document.getElementById('valFast').value),
    keyReset: document.getElementById('keyReset').value.toLowerCase(),
    keyWindowed: document.getElementById('keyWindowed').value.toLowerCase() // New
  };

  chrome.storage.sync.set(settings, () => {
    const status = document.getElementById('status');
    status.textContent = 'Ayarlar kaydedildi!';
    setTimeout(() => { status.textContent = ''; }, 1500);
  });
});