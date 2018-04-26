pragma solidity ^0.4.18;

contract CityWeather {
    
    // Allow one decimal place for the temperature, will be handled on web UI
    uint8 public constant decimals      = 1;
    uint  public constant decimalFactor = 10**uint(decimals);
    
    event LogCityAndTempUpdate(string city, int temp);
    
    string public cityName;
    int public cityTemp;
    
    function setCityAndTemp(string _city, int _temp ) public {
        cityName = _city;
        cityTemp = _temp;
        
        emit LogCityAndTempUpdate(_city, _temp);
    }
}