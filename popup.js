function createCrumbsDataElement() {
  let createCrumbsDataElementScript = `let div = document.createElement('div'); div.id = 'rx-bc-crumbs-data'; div.dataset.getItemsCrumb = _crumbs['api/orderhistory/1/get_items']; document.documentElement.appendChild(div);`;

  chrome.tabs.executeScript(
    null,
    {code: `
      (() => {
        let scriptElement = document.createElement('script');
        scriptElement.text = "${createCrumbsDataElementScript}";
        console.log('scriptElement', scriptElement);
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
      exported.push(order[exportedRowName] || '-');
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
    'artist_name',
    'item_title',
    'unit_price',
    'tax',
    'tax_type',
    'quantity',
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
    'last_token': pageData['orderhistory']['last_token'],
    'crumb': getItemsCrumb,
  };

  while (orders.length) {
    processedOrders += orders.length;
    ordersRows.push(...processPageData(orders, EXPORTED_ROWS));
    updateProgress(processedOrders, totalOrders);
    pageData = await fetchPageData(formData); 
    console.log('pageData', pageData);
    formData['last_token'] = pageData['last_token'];
    orders = pageData['items'];
    await sleep();
  }

  let csvContent = "data:text/csv;charset=utf-8,";

  ordersRows.splice(0, 0, EXPORTED_ROWS); // headers
  ordersRows.forEach(row => {
    contentRow = row.join(";");
    csvContent += `${contentRow}\n`;
  });

  window.open(csvContent);
}

(() => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('received message', request, sender, sendResponse);
    sendResponse({"ok": "bye"});
    //document.querySelector('#progress-text').innerText = `${evt.processedOrders} / ${evt.totalOrders}`;
  });

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
          let data = {
            getItemsCrumb: document.querySelector('#rx-bc-crumbs-data').dataset.getItemsCrumb,
            pageData: JSON.parse(document.querySelector("#pagedata").dataset["blob"])
          }; console.log('data', data);
          data
          `
        },
        (results) => {
          console.log('results', results);
          processOrders(results[0].pageData, results[0].getItemsCrumb);
        });
    };
  });
})();
