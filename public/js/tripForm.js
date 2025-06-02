console.log("tripform.js loaded");
console.log("hi from script");

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.custom-form');
  const tripType = form?.dataset.tripType || 'general';
  const packingToggle = document.getElementById('show-packing');
  const packingSection = document.getElementById('packing-section');
  const packingListUI = document.getElementById('packing-items-list');

  // Show/hide and load packing list
  packingToggle?.addEventListener('change', () => {
    if (packingToggle.value === 'yes') {
      packingSection.style.display = 'block';
      loadPackingOptions(tripType);
    } else {
      packingSection.style.display = 'none';
    }
  });

  // Load on page
  if (packingToggle?.value === 'yes') {
    packingSection.style.display = 'block';
    loadPackingOptions(tripType);
  }

  function loadPackingOptions(tripType) {
    fetch(`http://localhost:3777/packing/options/${tripType}`)
      .then(res => res.json())
      .then(items => {
        packingListUI.innerHTML = '';
        items.forEach(item => {
          const li = document.createElement('li');
          li.innerHTML = `
            <label>
              <input type="checkbox" name="packingItem" value="${item}">
              ${item}
            </label>`;
          packingListUI.appendChild(li);
        });

        const li = document.createElement('li');
        li.innerHTML = `
          <label>
            <input type="text" id="custom-packing-item" placeholder="Other item...">
          </label>`;
        packingListUI.appendChild(li);
      })
      .catch(err => {
        packingListUI.innerHTML = `<li>Error loading items.</li>`;
        console.error(err);
      });
  }

  // Inject hidden packing inputs
  form?.addEventListener('submit', () => {
    const packingItems = [...document.querySelectorAll('input[name="packingItem"]:checked')]
      .map(cb => cb.value.trim());

    const custom = document.getElementById('custom-packing-item')?.value.trim();
    if (custom) packingItems.push(custom);

    form.querySelectorAll('input[name="packingItems"]').forEach(e => e.remove());

    packingItems.forEach(item => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'packingItems';
      input.value = item;
      form.appendChild(input);
    });
  });
});