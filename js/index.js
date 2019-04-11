var app = {
  initialize: function() {
      document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
  },
  onDeviceReady: function() {
    this.receivedEvent('deviceready');
    geolocalitza();
    if (checkConnection() == 'No network connection') {   
      navigator.notification.alert(
          "No es pot connectar a Internet. Algunes característiques de l'App no estaran disponibles",  // message
          tancaDialeg,           // callback
          'Sense connexió',      // title
          "D'acord"              // buttonName
      );
      online = false;
    } else {
      online = true;
      baixaEstacions();
      baixaFenomens(); 
    }; 
  },
  receivedEvent: function(id) {
    var parentElement = document.getElementById(id);
    if(parentElement!=undefined) {
      var listeningElement = parentElement.querySelector('.listening');
      var receivedElement = parentElement.querySelector('.received');
      listeningElement.setAttribute('style', 'display:none;');
      receivedElement.setAttribute('style', 'display:block;');
      console.log('Received Event: ' + id);
    }
  }
};

function tancaDialeg() {
}

app.initialize();

var storage = window.localStorage;
var usuari = "";
var contrasenya;
var estacioActual;
var estacioPreferida;
var estacions;
var observacions;
var fenomens;
var latitudActual;
var longitudActual;
var url_servidor = "https://edumet.cat/edumet/meteo_2/dades_recarregar.php";
var INEactual = "081234";
var online;
var localitzat;

var input = document.getElementById('password');
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    valida();
  }
});

var map = L.map('map',{attributionControl:false}).setView([41.7292826, 1.8225154], 8);
L.tileLayer('https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png', {
	minZoom: 1,
	maxZoom: 19
}).addTo(map);

var mapaFitxa = L.map('mapaFitxa',{attributionControl:false}).setView([41.7292826, 1.8225154], 8);
L.tileLayer('https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png', {
	minZoom: 1,
	maxZoom: 19
}).addTo(mapaFitxa);

// BAIXA FENOMENS FENOLOGICS
function baixaFenomens() {
  var url = url_servidor + "?tab=llistaFenoFenologics";
  fetch(url)
  .then(response => response.text())
  .then(response =>  JSON.parse(response))
  .then(response => {
    console.log("FENOMENS");
    fenomens=response;
    var x = document.getElementById("fenomen");
    for(i=0;i<fenomens.length;i++){
      var option = document.createElement("option");
      option.text = fenomens[i]["Titol_feno"];
      option.value = fenomens[i]["Id_feno"];
      x.add(option);
      console.log(option.value + ", " + option.text);
    }
  });
}

// BAIXA ESTACIONS
function baixaEstacions() {
  var url = url_servidor + "?tab=cnjEstApp&xarxaEst=D";
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => {
    console.log("ESTACIONS");
    estacions=response;
    var x = document.getElementById("est_nom");
    var distanciaPropera = 1000;
    var distanciaProva;
    var estacioPropera = 0;
    for(i=0;i<estacions.length;i++){
      console.log(estacions[i]["Codi_estacio"] + ", " + estacions[i]["Nom_centre"]);
      L.marker(new L.LatLng(estacions[i]["Latitud"], estacions[i]["Longitud"])).addTo(map);    
      var option = document.createElement("option");
      option.text = estacions[i]["Nom_centre"];
      option.value = estacions[i]["Id_estacio"];
      x.add(option);      
    }
    preferida = storage.getItem("Id_estacio");
    if (preferida == null) {
      estacioActual = 0;
      estacioPreferida = 0;
    } else {
      for(i=0;i<estacions.length;i++){
        if(preferida == estacions[i]["Id_estacio"]) {
          estacioActual = i;
          estacioPreferida = i;
        }
      }
    }
    console.log("Preferida: " + estacioPreferida + ":" + estacions[estacioPreferida]["Nom_centre"]);
    document.getElementById("est_nom").value = estacions[estacioPreferida]["Id_estacio"];
    mostraEstacio();
  });
}

// BAIXA OBSERVACIONS
function getObservacions() {
  var url = url_servidor + "?usuari=" + usuari + "&tab=visuFenoApp";
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => {
    console.log("OBSERVACIONS");
    observacions=response;
    for(i=0;i<observacions.length;i++){
      console.log(observacions[i]["Data_observacio"] + ", " + observacions[i]["Latitud"] + ", " + observacions[i]["Longitud"]);
    }
  });
}

function activa(fragment) {
  document.getElementById('fenologia').style.display='none';
  document.getElementById('estacions').style.display='none';
  document.getElementById('radar').style.display='none';
  document.getElementById('previsio').style.display='none';
  document.getElementById('observacions').style.display='none';
  document.getElementById('fitxa').style.display='none';
  document.getElementById('login').style.display='none';
  document.getElementById(fragment).style.display='flex';
}

function login() {
  if (usuari == "") {
    usuari = storage.getItem("user");
  }
  if (usuari == null) {
    activa('login');
  }
  else {
    fenologia();
  }
}
function fenologia() {
  activa('fenologia');
  if (!localitzat) {
    geolocalitza();
  }
  getObservacions();
}
function estacio() {
  activa('estacions');
}
function radar() {
  activa('radar');
}
function previsio() {
  activa('previsio');
  document.getElementById('frame').src = "http://m.meteo.cat/?codi=" + INEactual;
  if (!localitzat) {
    geolocalitza();
  }
}
function observa() {
  activa('observacions');
  llistaObservacions();
}
function fitxa() {
  activa('fitxa');
  mapaFitxa.setView(new L.LatLng(latitudActual, longitudActual), 15);
}

function valida() {
  usuari = document.getElementById('usuari').value;
  contrasenya = document.getElementById('password').value;
  var url = url_servidor + "?ident=" + usuari + "&psw=" + contrasenya + "&tab=registrar_se"
  fetch(url)
  .then(response => response.text())
  .then(response => response.trim())
  .then(response => {
    if (response == "") {
      console.log("No Auth");
      usuari = "";
      navigator.notification.alert(
        "Usuari i/o contrasenya incorrectes. Si us plau, torna-ho a provar.",
        tancaDialeg,
        "Identificació",
        "D'acord"
      );
    } else {
      console.log("Auth OK " + usuari);
      storage.setItem("user", usuari);
      fenologia();
    }
  });
}

function selectEstacio() {  
  var x = document.getElementById("est_nom").value;
  for(i=0;i<estacions.length;i++){
    if(x == estacions[i]["Id_estacio"]) {
      estacioActual=i;
    }
  }
  if(estacioActual == estacioPreferida) {
    document.getElementById('star').src = "img/star-yellow.png";
  } else {
    document.getElementById('star').src = "img/star-border.png";
  }
  mostraEstacio();
}

function mostraEstacio() {
  document.getElementById('est_poblacio').innerHTML = estacions[estacioActual]["Poblacio"];
  document.getElementById('est_altitud').innerHTML = "Altitud: " + estacions[estacioActual]["Altitud"] + " m";
  var URLlogo = "https://edumet.cat/edumet-data/" + estacions[estacioActual]["Codi_estacio"] + "/estacio/profile1/imatges/fotocentre.jpg";
  document.getElementById('est_logo').src = URLlogo;
  map.setView(new L.LatLng(estacions[estacioActual]["Latitud"], estacions[estacioActual]["Longitud"]), 15);
  getMesures();
}

function desaPreferida() {
  storage.setItem("Id_estacio", document.getElementById("est_nom").value);
  for(i=0;i<estacions.length;i++){
    if(document.getElementById("est_nom").value == estacions[i]["Id_estacio"]) {
      estacioPreferida=i;
    }
  }
  document.getElementById('star').src = "img/star-yellow.png";
}

function geoFail() {
  console.log("GEOFAIL");
  localitzat = false;
}
function geoSuccess(position){
  console.log("GEOSUCCESS");
  latitudActual = position.coords.latitude;
  longitudActual = position.coords.longitude; 
  localitzat = true; 
  //map.setView(new L.LatLng(latitudActual, longitudActual), 15);
  var greenIcon = L.icon({
    iconUrl: 'img/marker-icon-green.png',
    iconAnchor: [12, 41]
  });
  L.marker(new L.LatLng(latitudActual, longitudActual),{icon: greenIcon}).addTo(map);
  preferida = storage.getItem("Id_estacio");
  if (preferida == null) {
    if(estacions!=undefined) {
      var distanciaPropera = 1000;
      var distanciaProva;
      var estacioPropera = 0;
      for(i=0;i<estacions.length;i++){
        distanciaProva = getDistanceFromLatLonInKm(latitudActual, longitudActual, estacions[i]["Latitud"], estacions[i]["Longitud"]);
        if(distanciaProva < distanciaPropera) {
          distanciaPropera = distanciaProva;
          estacioPropera = i;
        }
      }
      console.log("Preferida: " + estacioPropera + ":" + estacions[estacioPropera]["Nom_centre"]);
      estacioActual = estacioPropera;
      estacioPreferida = estacioPropera;
      storage.setItem("Id_estacio", estacions[estacioPreferida]["Id_estacio"]);
      document.getElementById("est_nom").value = estacions[estacioPreferida]["Id_estacio"];
      mostraEstacio();
    }
  }
}
function geolocalitza() {
  navigator.geolocation.getCurrentPosition(geoSuccess, geoFail, {});
}

function fesFoto() {
  var options = {
    // Some common settings are 20, 50, and 100
    quality: 20,
    destinationType: Camera.DestinationType.FILE_URI,
    targetHeight:800,
    targetWidth:800,
    sourceType: Camera.PictureSourceType.CAMERA,
    encodingType: Camera.EncodingType.JPEG,
    mediaType: Camera.MediaType.PICTURE,
    correctOrientation: true  // Corrects Android orientation quirks
  }
  navigator.camera.getPicture(onSuccess, onFail, options);  
  function onSuccess(imageURI) {
    var obs = document.getElementById('foto');
    obs.src = imageURI;
    getFileEntry(imageURI);
  }  
  function onFail(message) {
    navigator.notification.alert(
      "No s'ha pogut fer la foto",
      tancaDialeg,
      "Càmera",
      "D'acord"
    );
  }
}

function getMesures() {
  var url = url_servidor + "?tab=mobilApp&codEst=" + estacions[estacioActual]["Codi_estacio"];
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => { 
    document.getElementById('data_mesura').innerHTML = "Valors mesurats a " + response[0]["Hora_UTC"] + " " + response[0]["Data_UTC"];
    document.getElementById('temperatura').innerHTML = response[0]["Temp_ext_actual"]+ " ºC <label style='color:red'>" + response[0]["Temp_ext_max_avui"] + " ºC <label style='color:blue'>" + response[0]["Temp_ext_min_avui"] + " ºC</label>";
    document.getElementById('humitat').innerHTML = response[0]["Hum_ext_actual"] + "%";
    document.getElementById('pressio').innerHTML = response[0]["Pres_actual"] + " HPa";
    document.getElementById('sunrise').innerHTML = response[0]["Sortida_sol"].slice(0,5);
    document.getElementById('sunset').innerHTML = response[0]["Posta_sol"].slice(0,5);
    document.getElementById('pluja').innerHTML = response[0]["Precip_acum_avui"] + " mm";
    document.getElementById('vent').innerHTML = response[0]["Vent_vel_actual"] + " Km/h";    
    INEactual = response[0]["codi_INE"];
  });
}

function llistaObservacions() {
  var llista='';
  for(i=0;i<observacions.length;i++){
    llista+= '<div style="display:flex; align-items:center;">';
    llista+= '<div style="width:25%"><img src="' + 'https://edumet.cat/edumet/meteo_proves/imatges/fenologia/' + observacions[i]["Fotografia_observacio"] + '" style="width:10vh; height:10vh" onClick="fitxa();" /></div>';
    llista+= '<label style="width:25%">' + observacions[i]["Data_observacio"] + '</label>';
    llista+= '<label style="width:25%">' + fenomens[observacions[i]["Id_feno"]]["Titol_feno"] + '</label>';
    llista+= '<label style="width:25%">' + 'SI' + '</label>';
    llista+= '</div>';
  }
  document.getElementById('llistat').innerHTML = llista;
}

function getFileEntry(imgUri) {
  window.resolveLocalFileSystemURL(imgUri, function success(fileEntry) {
    // Do something with the FileEntry object, like write to it, upload it, etc.
    // writeFile(fileEntry, imgUri);
    console.log("got file: " + fileEntry.fullPath);
    // displayFileData(fileEntry.nativeURL, "Native URL");
  }, function () {
    // If don't get the FileEntry (which may happen when testing
    // on some emulators), copy to a new FileEntry.
    createNewFileEntry(imgUri);
  });
}

function createNewFileEntry(imgUri) {
  window.resolveLocalFileSystemURL(cordova.file.cacheDirectory, function success(dirEntry) {
      dirEntry.getFile("tempFile.jpeg", { create: true, exclusive: false }, function (fileEntry) {
          // Do something with it, like write to it, upload it, etc.
          // writeFile(fileEntry, imgUri);
          console.log("got file: " + fileEntry.fullPath);
          // displayFileData(fileEntry.fullPath, "File copied to");
      }, onErrorCreateFile);
  }, onErrorResolveUrl);
}

function checkConnection() {
  var networkState = navigator.connection.type;
  var states = {};
  states[Connection.UNKNOWN]  = 'Unknown connection';
  states[Connection.ETHERNET] = 'Ethernet connection';
  states[Connection.WIFI]     = 'WiFi connection';
  states[Connection.CELL_2G]  = 'Cell 2G connection';
  states[Connection.CELL_3G]  = 'Cell 3G connection';
  states[Connection.CELL_4G]  = 'Cell 4G connection';
  states[Connection.CELL]     = 'Cell generic connection';
  states[Connection.NONE]     = 'No network connection';
  console.log('Connection type: ' + states[networkState]);
  return states[networkState];
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}
