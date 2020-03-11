// Injects a `script` tag into the purchase page body that creates a `div`
// to store the crumb for the `/api/orderhistory/1/get_items endpoint`.
// This is necessary as the `_crumbs` variable is defined on the purchase page
// as a variable.
// Chrome extension popups do not have access a page's context - only to
// its DOM; injecting a script into the page's DOM and creating an element that
// stores data (via data attributes/element.dataset) makes it so the extension's
// popup's javascript can read that data added to the page's DOM.
//
// See Content Scripts:
// https://developer.chrome.com/extensions/content_scripts
function createCrumbsDataElement() {
  let createCrumbsDataElementScript = `let div = document.createElement('div'); div.id = 'rx-bc-crumbs-data'; div.dataset.getItemsCrumb = _crumbs['api/orderhistory/1/get_items']; document.documentElement.appendChild(div);`;

  chrome.tabs.executeScript(
    null,
    {code: `
      (() => {
        let scriptElement = document.createElement('script');
        scriptElement.text = "${createCrumbsDataElementScript}";
        document.documentElement.appendChild(scriptElement);
      })();
    `},
    () => {console.log('created #rx-bc-crumbs-data');}
  );
}

function randomTime() {
  let SLEEP_TIME_MIN = 200;
  let SLEEP_TIME_MAX = 550;

  let sleepMs = Math.floor(Math.random() * (SLEEP_TIME_MAX - SLEEP_TIME_MIN + 1) + SLEEP_TIME_MIN);
  return sleepMs;
}

function sleep(time) {
  return new Promise(resolve => setTimeout(resolve, randomTime()));
}

function processPageData(orders, exportedRowsNames) {
  let ordersRows = orders.map(order => {
    let exported = [];
    exportedRowsNames.forEach(exportedRowName => {
      exported.push(window.encodeURIComponent(`"${order[exportedRowName]}"`) || '-');
    });
    return exported;
  });
  console.log('order rows', ordersRows);
  return ordersRows;
}

async function fetchPageData(requestBody) {
  let headers = new Headers({'Content-Type': 'application/json; charset=UTF-8'})

  return fetch('https://bandcamp.com/api/orderhistory/1/get_items', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
        })
      .then(response => {
        return response.json()
      })
      .catch(error => console.error(error));
}

function updateProgress(processedOrders, totalOrders) {
  document.querySelector("span#progress-text").innerText = `${processedOrders} / ${totalOrders}`;
}

async function processOrders(pageData, getItemsCrumb) {
  let EXPORTED_ROWS = [
    'payment_date',
    'bandcamp_id',
    'artist_name',
    'item_title',
    'quantity',
    'unit_price',
    'tax',
    'tax_type',
    'currency',
    'card_brand',
    'card_num',
    'payer_email',
    'item_url',
    'download_url',
  ];
  let orders = pageData['orderhistory']['items'];
  let totalOrders = pageData['orderhistory']['total_items']
  let processedOrders = 0;
  let ordersRows = []

  let formData = {
    'username': pageData['orderhistory']['username'],
    'platform': pageData['orderhistory']['platform'],
    'last_token': pageData['orderhistory']['last_token'], // pagination token for the most recently fetched order
    'crumb': getItemsCrumb, // validation token, specific per API endpoint, expires after some time
  };
  // TODO: refresh crumb via 400 server response
  // when an API request is sent with an invalid crumb, the server responds with
  // a new valid one.

  while (orders.length) {
    ordersRows.push(...processPageData(orders, EXPORTED_ROWS));
    processedOrders += orders.length;
    updateProgress(processedOrders, totalOrders);

    pageData = await fetchPageData(formData);
    formData['last_token'] = pageData['last_token'];
    orders = pageData['items'];
    await sleep(); // add sleep to simulate user scrolling and not hammer the server
  }

  let csvContent = "data:text/csv;charset=utf-8,";

  ordersRows.splice(0, 0, EXPORTED_ROWS); // headers
  ordersRows.forEach(row => {
    contentRow = row.join(window.encodeURIComponent(";")); // escaping ';' delimiter as it's reserved for URIs
    console.log('add row to csv', contentRow);
    csvContent += `${contentRow}\n`;
  });

  let downloadLink = document.querySelector("#download-link");
  let date = new Date().toISOString().split('T')[0]; // iso string date e.g: 2020-03-11T02:09:22.833Z
  downloadLink.style.display = 'block';
  downloadLink.href = csvContent;
  downloadLink.download = `${date}_bandcamp_purchases_${totalOrders}_orders.csv`;
}

(() => {
  document.addEventListener("DOMContentLoaded", function(evt) {
    let loadHistoryButton = document.querySelector('#load');
    let scriptElement = document.createElement('script');

    chrome.tabs.executeScript(
      null,
      {code: "document.querySelector('#rx-bc-crumbs-data') ? true : false"},
      (results) => {
        let crumbsDataElementExists = results[0];
        if (!crumbsDataElementExists) {
          createCrumbsDataElement();
        }
      });

    loadHistoryButton.onclick = (evt) => {
      document.querySelector('button#load').disabled = true;
      chrome.tabs.executeScript(
        null,
        {code:
          `
            var bcData = {
              getItemsCrumb: document.querySelector('#rx-bc-crumbs-data').dataset.getItemsCrumb,
              pageData: JSON.parse(document.querySelector("#pagedata").dataset["blob"])
            };
            bcData
          ` // `chrome.tabs.executeScript` in `code` mode doesn't accept `return` statements.
            // To send data to the `results` callback, you need to reference the
            // variable you want to return in the last statement of the code string.
        },
        (results) => {
          processOrders(results[0].pageData, results[0].getItemsCrumb);
        });
    };
  });
})();
