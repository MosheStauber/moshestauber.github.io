var apiKey = "52b7f7cb36730f1d3cdb5314ea774852"
var currentNetwork;
var cityWeatherContract;
var contractDecimalFactor;

/*  Loads the web3 context  */
window.addEventListener('load', function() {

  currentNetwork = null;

  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    // Use Mist/MetaMask's provider
    web3js = new Web3(web3.currentProvider);
  } else {
    alert('you must have metamask installed');
    // use localhost (testrpc)
    web3js = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }

  // log eth network
  web3js.version.getNetwork((err, netId) => {
    switch (netId) {
      case "1":
        currentNetwork = 'mainnet';
        break;
      case "2":
        currentNetwork = 'the deprecated Morden test network.';
        break;
      case "3":
        currentNetwork = 'ropsten';
        break;
      case "4":
        currentNetwork = 'rinkeby';
        break;
      case "42":
        currentNetwork = 'kovan';
        break;
      default:
        currentNetwork = 'unknown';
    }

  });
 
  var contract = web3js.eth.contract(contractABI);
  cityWeatherContract = contract.at(contractAddress);

  // Get the decimal factor the contract uses to convert between temp float and contract int
  cityWeatherContract.decimalFactor((err, res) => {
	if (err){
		console.log(err);
		return;
	}
	// force floating point number
	contractDecimalFactor = res * 1.0;
	getCurrentContractData();
  });

  loadUserInfo();

});


/* If the city is valid, commit the transaction to the blockchain */
function postToBlockchain() {
	var cityNameInput = document.getElementById('city_input');
	var temperatureInput = document.getElementById('temp_input');

	var url = `http://api.openweathermap.org/data/2.5/weather?q=${cityNameInput.value}&APPID=${apiKey}`;
	
	// Check if the city exists in the weather api database
	fetch(url)
	.then((response) => {
		// reject if 404 not found
		if (!response.ok) 
			return Promise.reject({status: response.status,statusText: response.statusText});
		return response.json();
	})
	// If all is well, post to blockchain
	.then((data) => {
		var cityName = data.name; // use the official name from the weather source
		var temperature = temperatureInput.value;

		// convert the temperature to smart contract value with correct decimal places
		temperature *= contractDecimalFactor;

		// Send the transaction to ethereum blockchain
		cityWeatherContract.setCityAndTemp.sendTransaction(cityName, temperature, (err, res) => {
			if (err){
				console.log(err);
				return;
			}

			// Show etherscan link while waiting for receipt
			var etherscanLink = document.getElementById('etherscan_link');
  			etherscanLink.href = "http://"+ (currentNetwork=="mainnet"?"":currentNetwork+".")+"etherscan.io/tx/"+res;
  			etherscanLink.style.display = 'block';

  			// wati for transaction to be mined
			waitForReceipt(res, function(receipt){
				// hide etherscan link
				etherscanLink.style.display = 'none';
				// Update data on screen 
				getCurrentContractData();

				// show countdown timer for actual temp reading
				document.getElementById('countdown_p').style.display = 'block';

				var actualReadingWait = 30000; // 30 seconds
				var timeOfReading = new Date().getTime() + actualReadingWait;

				var timer = setInterval(() => {
					// Get todays date and time
				    var now = new Date().getTime();
				    
				    // Find the distance between now an the count down time
				    var seconds = Math.floor((timeOfReading - now )/ 1000);
				    document.getElementById('countdown').textContent = "" + seconds +" seconds";
				}, 1000);

				// Get actual temp reading in `actualReadingWait` time
				window.setTimeout(() => {
					clearInterval(timer);
					document.getElementById('countdown_p').style.display = 'none';
					compareTemperaturePrediction();
				}, actualReadingWait);
			})
		});
		
	})
	// Show invalid input hint to user
	.catch((error) => {
		console.log(error);
		cityNameInput.setCustomValidity(`${cityNameInput.value} is not a valid city`);
		cityNameInput.reportValidity();
	});
}

/* Retrieves the current contract data and diplays on page*/
function getCurrentContractData(){
	cityWeatherContract.cityName((err,res) => {
		if (err){
			console.log(err);
			return;
		}
		document.getElementById('city_name').innerHTML = res;
	});

	cityWeatherContract.cityTemp((err,res) => {
		if (err){
			console.log(err);
			return;
		}
		var temp = res.toNumber()/contractDecimalFactor;
		document.getElementById('contract_temp').textContent = temp; 
	});
}

/* gets the current weather for the city and compares it to contract data */
function compareTemperaturePrediction(){
	var contractTemp = document.getElementById('contract_temp').textContent;
	var cityName = document.getElementById('city_name').textContent

	var url = `http://api.openweathermap.org/data/2.5/weather?q=${cityName}&APPID=${apiKey}`;
	
	// get the weather for the city
	fetch(url)
	.then((response) => {
		if (!response.ok) 
			return Promise.reject({status: response.status,statusText: response.statusText});
		return response.json();
	})
	.then((data) => {
		var actualTemp = returnFahrenheit(data.main.temp);
		document.getElementById('actual_temp').textContent = actualTemp;

		var higherOrLower = "Actual temp is " + (actualTemp > contractTemp ? 'Higher':"Lower");
		document.getElementById('higher_lower').textContent = higherOrLower;
	})
	.catch((error) => {
		alert("Not a valid city! No weather update.");
	});
}

/* Accepts temperature in kelvin and returns value in farenheit */
function returnFahrenheit(temp) {
    return ((Math.round(((temp - 273.15) * 9 / 5 + 32) * 10)) / 10);
}



/* Waits for a receipt verifying transaction was mined */
function waitForReceipt(hash, callback) {
  console.log(hash);
  web3js.eth.getTransactionReceipt(hash, function (err, receipt) {
    if (err) {
      error(err);
    }

    if (receipt !== null) {
      // Transaction went through
      if (callback) {
        callback(receipt);
      }
    } else {
      // Try again in 1 second
      window.setTimeout(function () {
        waitForReceipt(hash, callback);
      }, 1000);
    }
  });
}

/* Gets some basic user info as it would on etherscan.io */
function loadUserInfo(){
	document.getElementById('eth_address').textContent = web3js.eth.defaultAccount;
	web3js.eth.getBalance(web3js.eth.defaultAccount, (e,r) => {
		if(e) return;		
		document.getElementById('eth_balance').textContent = web3.fromWei(String(r.toNumber()), 'ether');
	});
	web3js.eth.getTransactionCount(web3js.eth.defaultAccount, (e,r) => {
		if(e) return;
		document.getElementById('number_of_txs').textContent = r;
	});

	web3js.eth.getBlock('latest', function(e,r){
		getLastNAccountTransactions(web3js.eth.defaultAccount,r.number, 25);
	})
}


function getLastNAccountTransactions(accAddress, endBlockNumber, N) {
  var txList = document.getElementById("lastNtx");
  var txCount = 0;
  for (var i = endBlockNumber; i > endBlockNumber-1000 && txCount < N; i--) {
  	// console.log(endBlockNumber - i);
    web3js.eth.getBlock(i, true, function(error, result){
    	if (!error){
		    if ( result != null && result.transactions != null) {
		      result.transactions.forEach( function(e) {
		        if (accAddress == "*" || accAddress == e.from || accAddress == e.to) {
		        	txCount++;
		        	var link = document.createElement('a');
					link.target = '_blank';
					link.href = "https://rinkeby.etherscan.io/tx/"+e.hash;
		        	link.innerHTML = e.hash;

		        	var li = document.createElement('li');
		        	li.appendChild(link);
		        	txList.appendChild(li);
		        }
		      })
		    }
		}
    });
  }
}




var contractAddress = "0x73cdbe6bb98081617e8756b4b6f08324072d4986";
var contractABI = [
	{
		"constant": true,
		"inputs": [],
		"name": "decimals",
		"outputs": [
			{
				"name": "",
				"type": "uint8"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": false,
		"inputs": [
			{
				"name": "_city",
				"type": "string"
			},
			{
				"name": "_temp",
				"type": "int256"
			}
		],
		"name": "setCityAndTemp",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [],
		"name": "decimalFactor",
		"outputs": [
			{
				"name": "",
				"type": "uint256"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [],
		"name": "cityTemp",
		"outputs": [
			{
				"name": "",
				"type": "int256"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [],
		"name": "cityName",
		"outputs": [
			{
				"name": "",
				"type": "string"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"name": "city",
				"type": "string"
			},
			{
				"indexed": false,
				"name": "temp",
				"type": "int256"
			}
		],
		"name": "LogCityAndTempUpdate",
		"type": "event"
	}
];