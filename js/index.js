var app = {
  // Application Constructor
  initialize: function() {
      document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
  },
  // deviceready Event Handler
  // Bind any cordova events here. Common events are:
  // 'pause', 'resume', etc.
  onDeviceReady: function() {
    this.receivedEvent('deviceready');
  },
  // Update DOM on a Received Event
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

app.initialize();

// FENOMENS FENOLOGICS
var fenomens;
var url_servidor = "https://edumet.cat/edumet/meteo_2/dades_recarregar.php";
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

var storage = window.localStorage;

function login() {
  if (usuari == "") {
    usuari = storage.getItem("user");
  }
  if (usuari == null) {
    document.getElementById('fenologia').style.display='none';
    document.getElementById('estacions').style.display='none';
    document.getElementById('radar').style.display='none';
    document.getElementById('previsio').style.display='none';
    document.getElementById('observacions').style.display='none';
    document.getElementById('login').style.display='flex';
  }
  else {
    fenologia();
  }
}
function fenologia() {
  document.getElementById('login').style.display='none';
  document.getElementById('estacions').style.display='none';
  document.getElementById('radar').style.display='none';
  document.getElementById('previsio').style.display='none';
  document.getElementById('observacions').style.display='none';
  document.getElementById('fenologia').style.display='flex';
  if (latitudActual==undefined) {
    geolocalitza();
  }
  getObservacions();
}
function estacio() {
  document.getElementById('login').style.display='none';
  document.getElementById('fenologia').style.display='none';
  document.getElementById('radar').style.display='none';
  document.getElementById('previsio').style.display='none';
  document.getElementById('observacions').style.display='none';
  document.getElementById('estacions').style.display='flex';
}
function radar() {
  document.getElementById('login').style.display='none';
  document.getElementById('fenologia').style.display='none';
  document.getElementById('estacions').style.display='none';
  document.getElementById('previsio').style.display='none';
  document.getElementById('observacions').style.display='none';
  document.getElementById('radar').style.display='flex';
}
function previsio() {
  document.getElementById('login').style.display='none';
  document.getElementById('fenologia').style.display='none';
  document.getElementById('radar').style.display='none';
  document.getElementById('estacions').style.display='none';
  document.getElementById('observacions').style.display='none';
  document.getElementById('previsio').style.display='flex';
  if (latitudActual==undefined) {
    geolocalitza();
  }
}
function observa() {
  document.getElementById('login').style.display='none';
  document.getElementById('fenologia').style.display='none';
  document.getElementById('radar').style.display='none';
  document.getElementById('previsio').style.display='none';
  document.getElementById('estacions').style.display='none';
  document.getElementById('observacions').style.display='flex';
  llistaObservacions();
}

var usuari = "";
var contrasenya;

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
      alert("Usuari i/o contrasenya incorrectes. Si us plau, torna-ho a provar.");
    } else {
      console.log("Auth OK " + usuari);
      storage.setItem("user", usuari);
      fenologia();
    }
  });
}

var input = document.getElementById('password');
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    valida();
  }
});

//ESTACIONS
var estacions;
var url = url_servidor + "?tab=cnjEstApp&xarxaEst=D";
fetch(url)
.then(response => response.text())
.then(response => JSON.parse(response))
.then(response => {
  console.log("ESTACIONS");
  estacions=response;
  for(i=0;i<estacions.length;i++){
    console.log(estacions[i]["Codi_estacio"] + ", " + estacions[i]["Nom_centre"]);
    L.marker(new L.LatLng(estacions[i]["Latitud"], estacions[i]["Longitud"])).addTo(map);    
  }
  document.getElementById('est_nom').innerHTML = estacions[0]["Nom_centre"];
  document.getElementById('est_poblacio').innerHTML = estacions[0]["Poblacio"];
  document.getElementById('est_altitud').innerHTML = "Altitud: " + estacions[0]["Altitud"] + " m";
  var URLlogo = "https://edumet.cat/edumet-data/" + estacions[0]["Codi_estacio"] + "/estacio/profile1/imatges/fotocentre.jpg";
  document.getElementById('est_logo').src = URLlogo;
  getMesures();
});

//OBSERVACIONS
var observacions;

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

var map = L.map('map',{attributionControl:false}).setView([41.7292826, 1.8225154], 8);
L.tileLayer('https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png', {
	minZoom: 1,
	maxZoom: 19
}).addTo(map);

var latitudActual;
var longitudActual;

function geoFail() {
  console.log("GEOFAIL");
}
function geoSuccess(position){
  console.log("GEOSUCCESS");
  latitudActual = position.coords.latitude;
  longitudActual = position.coords.longitude;  
  map.setView(new L.LatLng(latitudActual, longitudActual), 15);
  var greenIcon = L.icon({
    iconUrl: 'img/marker-icon-green.png',
    iconAnchor: [12, 41]
  });
  L.marker(new L.LatLng(latitudActual, longitudActual),{icon: greenIcon}).addTo(map);
}

function geolocalitza() {
  navigator.geolocation.getCurrentPosition(geoSuccess, geoFail, {});
}

geolocalitza();

function fesFoto() {
  var options = {
    // Some common settings are 20, 50, and 100
    quality: 50,
    destinationType: Camera.DestinationType.FILE_URI,
    // In this app, dynamically set the picture source, Camera or photo gallery
    sourceType: Camera.PictureSourceType.CAMERA,
    encodingType: Camera.EncodingType.JPEG,
    mediaType: Camera.MediaType.PICTURE,
    allowEdit: true,
    correctOrientation: true  // Corrects Android orientation quirks
  }
  navigator.camera.getPicture(onSuccess, onFail, options);  
  function onSuccess(imageURI) {
    var obs = document.getElementById('foto');
    obs.src = imageURI;
  }  
  function onFail(message) {
    alert('Error: ' + message);
  }
}

function getMesures() {
  var url = url_servidor + "?tab=mobilApp&codEst=" + estacions[0]["Codi_estacio"];
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
  });
}

function llistaObservacions() {
  var llista='';
  for(i=0;i<observacions.length;i++){
    llista+= '<div style="display:flex; align-items:center;">';
    llista+= '<div style="width:25%"><img src="' + 'https://edumet.cat/edumet/meteo_proves/imatges/fenologia/' +observacions[i]["Fotografia_observacio"] + '" style="width:10vh; height:10vh" /></div>';
    llista+= '<label style="width:25%">' + observacions[i]["Data_observacio"] + '</label>';
    llista+= '<label style="width:25%">' + fenomens[observacions[i]["Id_feno"]]["Titol_feno"] + '</label>';
    llista+= '<label style="width:25%">' + 'SI' + '</label>';
    llista+= '</div>';
  }
  document.getElementById('llistat').innerHTML = llista;
}
