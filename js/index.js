/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },
    // deviceready Event Handler
    //
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

function fenologia() {
  document.getElementById('fenologia').style.display='flex';
  document.getElementById('estacions').style.display='none';
}

function estacio() {
  document.getElementById('fenologia').style.display='none';
  document.getElementById('estacions').style.display='flex';
  if(latitudActual==undefined) {
    geolocalitza();
  }
}

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
  console.log(URLlogo);
  document.getElementById('est_logo').src = URLlogo;
  getMesures();
});

//OBSERVACIONS
var observacions;

function getObservacions() {
  //var url = url_servidor + "?usuari=" + usuari + "&tab=visuFenoApp";
  var url = url_servidor + "?usuari=43900018" + "&tab=visuFenoApp";
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

getObservacions();

var map = L.map('map').setView([41.7292826, 1.8225154], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
  map.setView(new L.LatLng(latitudActual, longitudActual),15);
  L.marker(new L.LatLng(latitudActual, longitudActual)).addTo(map);
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
      correctOrientation: true  //Corrects Android orientation quirks
  }
  navigator.camera.getPicture(onSuccess, onFail, options);  
  function onSuccess(imageURI) {
    var elem = document.getElementById('foto');
    elem.src = imageURI;
  }  
  function onFail(message) {
      alert('Failed because: ' + message);
  }
}

var mesures;

function getMesures() {
  var url = url_servidor + "?tab=mobilApp&codEst=" + estacions[0]["Codi_estacio"];
  console.log(url);
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => {
    console.log("MESURES");
    mesures=response;
    document.getElementById('data_mesura').innerHTML = mesures[0]["Data_UTC"];
    console.log(mesures[0]["Data_UTC"]);
  });
}
