var app = {
  initialize: function() {
      document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
  },
  onDeviceReady: function() {
    this.receivedEvent('deviceready');
    document.addEventListener("backbutton", onBackKeyDown, false);
    db = window.openDatabase('Edumet', '', 'Base de dades Edumet', 10000);
    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fs) {
      console.log('File system open: ' + fs.name);
      fileSystem = fs;
    });
    geolocalitza();
    if (checkConnection() == 'No network connection') {   
      navigator.notification.alert(
          "No es pot connectar a Internet. Algunes característiques de l'App no estaran disponibles",  // message
          empty,
          'Sense connexió',
          "D'acord"
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

var storage = window.localStorage;
var db;
var usuari = "";
var contrasenya;
var estacioActual;
var estacioPreferida;
var estacions;
var numObs;
var fenomens = [];
var latitudActual;
var longitudActual;
var url_servidor = "https://edumet.cat/edumet/meteo_proves/dades_recarregar.php";
var INEactual = "081234";
var online;
var localitzat;
var fotoBaixada;
var fileSystem;
var observacioActual;
var mapaFitxa;
var marcadorFitxa;

app.initialize();

function empty() {  
}

function onBackKeyDown() {
  navigator.notification.confirm("Vols sortir de l'App?", sortir, "EDUMET", ["Sortir","Cancel·lar"]);
}

function sortir(buttonIndex) {
  if(buttonIndex == 1) {
    navigator.app.exitApp();
  }
}

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



// BAIXA FENOMENS FENOLOGICS
function baixaFenomens() {
  var url = url_servidor + "?tab=llistaFenoFenologics";
  fetch(url)
  .then(response => response.text())
  .then(response =>  JSON.parse(response))
  .then(response => {
    console.log("FENOMENS: Baixats");
    var x = document.getElementById("fenomen");
    for(i=0;i<response.length;i++){
      fenomens[i+1] = response[i];
      var option = document.createElement("option");
      option.text = response[i]["Titol_feno"];
      option.value = response[i]["Id_feno"];
      x.add(option);
    }
    db.transaction(function (tx) {
      tx.executeSql('DROP TABLE IF EXISTS Fenomens'); 
      tx.executeSql('CREATE TABLE Fenomens (Id_feno, Titol_feno)');   
      for(i=0;i<response.length;i++){
        var query = 'INSERT INTO Fenomens (Id_feno, Titol_feno) VALUES ("';
        query += response[i]["Id_feno"] + '","';
        query += response[i]["Titol_feno"] + '")';
        tx.executeSql(query);    
      }
    });
  });
}

// BAIXA ESTACIONS
function baixaEstacions() {
  var url = url_servidor + "?tab=cnjEstApp&xarxaEst=D";
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => {
    console.log("ESTACIONS: Baixades");
    estacions=response;
    var x = document.getElementById("est_nom");
    var distanciaPropera = 1000;
    var distanciaProva;
    var estacioPropera = 0;  
    for(i=0;i<estacions.length;i++){
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
          document.getElementById("est_nom").value = estacions[estacioPreferida]["Id_estacio"];
        }
      }
    }
    console.log("Preferida: " + estacioPreferida + ":" + estacions[estacioPreferida]["Nom_centre"]);
    mostraEstacio();
    db.transaction(function (tx) {
      tx.executeSql('DROP TABLE IF EXISTS Estacions'); 
      tx.executeSql('CREATE TABLE Estacions (Id_estacio, Codi_estacio, Nom_centre, Poblacio, Latitud, Longitud, Altitud)');   
      for(i=0;i<estacions.length;i++){
          var query = 'INSERT INTO Estacions (Id_estacio, Codi_estacio, Nom_centre, Poblacio, Latitud, Longitud, Altitud) VALUES ("';
          query += estacions[i]["Id_estacio"] + '","';
          query += estacions[i]["Codi_estacio"] + '","';
          query += estacions[i]["Nom_centre"] + '","';
          query += estacions[i]["Poblacio"] + '","';
          query += estacions[i]["Latitud"] + '","';
          query += estacions[i]["Longitud"] + '","';
          query += estacions[i]["Altitud"] + '")';
          tx.executeSql(query);    
        }
      });
  });
}

// BAIXA OBSERVACIONS INICIAL
function baixaObsInicial() {
  var url = url_servidor + "?usuari=" + usuari + "&tab=visuFenoApp";
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => {
    numObs  = response.length;
    db.transaction(function (tx) {
      tx.executeSql('CREATE TABLE Observacions (ID, Data_observacio, Hora_observacio, Latitud, Longitud, Id_feno, Descripcio_observacio, Fotografia_observacio, Local_path, Enviat)');   
      for(i=0;i<numObs;i++){
        var query = 'INSERT INTO Observacions (ID, Data_observacio, Hora_observacio, Latitud, Longitud, Id_feno, Descripcio_observacio, Fotografia_observacio, Local_path, Enviat) VALUES ("';
        query += response[i]["ID"] + '","';
        query += response[i]["Data_observacio"] + '","';
        query += response[i]["Hora_observacio"] + '","';
        query += response[i]["Latitud"] + '","';
        query += response[i]["Longitud"] + '","';
        query += response[i]["Id_feno"] + '","';
        query += response[i]["Descripcio_observacio"] + '","';
        query += response[i]["Fotografia_observacio"] + '","';
        query += '0' + '","';
        query += '1' + '")';   
        tx.executeSql(query);
        console.log("Nova observació: " + response[i]["ID"]);
        baixaFoto(response[i]["ID"],response[i]["Fotografia_observacio"]); 
      }
    });
  });  
}

// BAIXA OBSERVACIONS AFEGIDES
function baixaObsAfegides() {
  var url = url_servidor + "?usuari=" + usuari + "&tab=visuFenoApp";
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => {
    db.transaction(function (tx) { 
      for(i=0;i<response.length;i++){
        var query = 'SELECT COUNT(ID) FROM Observacions WHERE ID="' + response[i]["ID"] +'"';
        console.log(query);
        var query2 = 'INSERT INTO Observacions (ID, Data_observacio, Hora_observacio, Latitud, Longitud, Id_feno, Descripcio_observacio, Fotografia_observacio, Local_path, Enviat) VALUES ("';
        query2 += response[i]["ID"] + '","';
        query2 += response[i]["Data_observacio"] + '","';
        query2 += response[i]["Hora_observacio"] + '","';
        query2 += response[i]["Latitud"] + '","';
        query2 += response[i]["Longitud"] + '","';
        query2 += response[i]["Id_feno"] + '","';
        query2 += response[i]["Descripcio_observacio"] + '","';
        query2 += response[i]["Fotografia_observacio"] + '","';
        query2 += '0' + '","';
        query2 += '1' + '")';
        var foto = response[i]["Fotografia_observacio"];
        var id = response[i]["ID"];
        tx.executeSql(query, [], function(tx, results){
          console.log(results.rows[0]["COUNT(ID)"]);
          if(results.rows[0]["COUNT(ID)"] == "0") {      
          
            tx.executeSql(query2);

            baixaFoto(id,foto); 
            console.log("Nova observació: " + id);
          }
        },
        empty);
      }
    });
  });  
}

function baixaFoto(id,foto) {
  fileSystem.root.getFile(foto, { create: true, exclusive: false }, function (fileEntry) {
    var url = 'https://edumet.cat/edumet/meteo_proves/imatges/fenologia/' + foto;
    //console.log(url);
    fetch(url)
    .then(response => response.blob())
    .then(response => {
      var blob = new Blob([response], { type: 'image/jpeg' });
      writeFile(fileEntry, blob);
      db.transaction(function (tx) {
        var query = 'UPDATE Observacions SET Local_path="';
        query += fileEntry.toURL();;
        query += '" WHERE ID="';
        query += id;
        query += '"';
        tx.executeSql(query);
      });
    });        
  }, empty);
}
 
function writeFile(fileEntry, dataObj) {
  fileEntry.createWriter(function (fileWriter) {
    fileWriter.onwriteend = function() {
    };
    fileWriter.onerror = function (e) {
      console.log("Failed file write: " + e.toString());
    };
    fileWriter.write(dataObj);
  });
}

function enviaObservacio() {
  db.transaction(function (tx) {
    var query = 'SELECT * FROM Observacions WHERE Local_path=\'' + observacioActual +'\'';
    console.log(query);      
    tx.executeSql(query, [], function(tx, rs){  
      var fitxaObs = rs.rows.item(0);
      if(fitxaObs["Enviat"] == "0") {
        window.resolveLocalFileSystemURL(fitxaObs["Local_path"], gotFile, fail);          
        function fail(e) {
          alert('Cannot found requested file');
        }
        function gotFile(fileEntry) {
          fileEntry.file(function(file) {
            var reader = new FileReader();
            reader.onload = function(e) {
              var imatge64 = e.target.result.replace(/^data:image\/[a-z]+;base64,/, "");                
              var envio = { tab: "salvarFenoApp",
                  usuari: usuari,
                  dia: fitxaObs["Data_observacio"],
                  hora: fitxaObs["Hora_observacio"],
                  lat: fitxaObs["Latitud"],
                  lon: fitxaObs["Longitud"],
                  id_feno: fitxaObs["Id_feno"],
                  descripcio: fitxaObs["Descripcio_observacio"],
                  fitxer: imatge64
              }
              var JSONenvio = JSON.stringify(envio);
              console.log("JSON:" + JSONenvio);
              fetch(url_servidor + '/dades_recarregar.php',{
                method:'POST',
                headers:{
                  'Content-Type': 'application/json; charset=UTF-8'
                  },
                body: JSONenvio
                })
                .then(response => response.text())
                .then(response => {   
                  db.transaction(function (tx) {
                    var query = 'UPDATE Observacions SET ID=';
                    query += response.trim();
                    query += ', Enviat=1';
                    query += ' WHERE Local_path="';
                    query += fitxaObs["Local_path"];
                    query += '"';
                    console.log(query);
                    tx.executeSql(query, [], function(tx, results){
                      navigator.notification.alert(
                        "S'ha penjat l'observació al servidor Edumet.",
                        empty,
                        'Penjar observació',
                        "D'acord"
                      );
                    },
                    empty);
                  });       
                });
            };
            reader.readAsDataURL(file);
          });
        }
      }      
    }, empty);    
  });  
}

function eliminaObservacio() {
  db.transaction(function (tx) {
    var query = 'SELECT ID,Enviat,Local_path FROM Observacions WHERE Local_path=\'' + observacioActual +'\'';
    console.log(query);      
    tx.executeSql(query, [], function(tx, rs){  
      var fitxaObs = rs.rows.item(0);

      if(fitxaObs["Enviat"] == "1") {
        var url = url_servidor + "?usuari=" + usuari + "&id=" + fitxaObs["ID"]+ "&tab=eliminarFenUsu";
        fetch(url);
      }
      var query = 'DELETE FROM Observacions WHERE Local_path=\'' + fitxaObs["Local_path"] +'\'';

      tx.executeSql(query, [], function(tx, results){
        navigator.notification.alert(
          "S'ha eliminat l'observació.",
          empty,
          'Eliminar observació',
          "D'acord"
        );
      });
    }, empty);    
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
  //baixaObsAfegides();
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
function fitxa(id) {
  observacioActual = id;
  activa('fitxa');
  db.transaction(function (tx) {
    var query = 'SELECT * FROM Observacions WHERE Local_path=\'' + observacioActual +'\'';
    console.log(query);      
    tx.executeSql(query, [], function(tx, rs){      
      var fitxaObs = rs.rows.item(0);
      var nomFenomen = document.getElementById('nomFenomen');
      nomFenomen.innerHTML = fenomens[fitxaObs["Id_feno"]]["Titol_feno"];
      var dataHora = document.getElementById('dataHora');
      dataHora.innerHTML = formatDate(fitxaObs["Data_observacio"]) + '  -  ' + fitxaObs["Hora_observacio"];
      var fotoFitxa = document.getElementById('fotoFitxa');
      fotoFitxa.src = fitxaObs["Local_path"];
      var descripcioFitxaFitxa = document.getElementById('descripcioFitxa');
      descripcioFitxaFitxa.innerHTML = fitxaObs["Descripcio_observacio"];
      try {
        mapaFitxa = L.map('mapaFitxa',{attributionControl:false}).setView(new L.LatLng(fitxaObs["Latitud"], fitxaObs["Longitud"]), 15);
        L.tileLayer('https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png', {
          minZoom: 1,
          maxZoom: 19
        }).addTo(mapaFitxa);
      } catch {
        mapaFitxa.setView(new L.LatLng(fitxaObs["Latitud"],fitxaObs["Longitud"]), 15);
        mapaFitxa.removeLayer(marcadorFitxa);
      }
      marcadorFitxa = L.marker(new L.LatLng(fitxaObs["Latitud"], fitxaObs["Longitud"]));
      marcadorFitxa.addTo(mapaFitxa);
    }, empty);    
  });
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
        empty,
        "Identificació",
        "D'acord"
      );
    } else {
      console.log("Auth OK " + usuari);
      storage.setItem("user", usuari);
      baixaObsInicial();
      activa('fenologia');
      //fenologia();
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
    window.resolveLocalFileSystemURL(imageURI, function success(fileEntry) {   
      fileEntry.copyTo(fileSystem.root,"", desaObservacio, empty);       
    }, empty);    
  }  
  function onFail(message) {
    navigator.notification.alert(
      "No s'ha pogut fer la foto",
      empty,
      "Càmera",
      "D'acord"
    );
  }
}

function actualitzaObservacio() {
  db.transaction(function (tx) {
    var Id_feno = document.getElementById('fenomen').value;
    var Descripcio_observacio = document.getElementById('descripcio').value;
    var query = 'SELECT * FROM Observacions WHERE Local_path=\'' + observacioActual +'\'';
    console.log(query);  
        
    tx.executeSql(query, [], function(tx, rs){  
      var fitxaObs = rs.rows.item(0);
      query = 'UPDATE Observacions SET Id_feno="';
      query += Id_feno;
      query += '", Descripcio_observacio="';
      query += Descripcio_observacio;
      query += '" WHERE Local_path="';
      query += fitxaObs["Local_path"];
      query += '"';
      console.log(query);
      tx.executeSql(query, [], function(tx, results){
        navigator.notification.alert(
          "S'ha desat el tipus d'observació i la descripció del fenomen.",
          empty,
          'Desar',
          "D'acord"
        );
      },
      empty);           
    }, empty);    
  }); 
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
  db.transaction(function (tx) {
    var query = 'SELECT * FROM Observacions';
    tx.executeSql(query, [], function(tx, rs){
      var llista='';
      for(var i=0; i<rs.rows.length; i++) {
        var obsLlista = rs.rows.item(i);
        llista+= '<div style="display:flex; align-items:center;" onClick="fitxa(\'' + obsLlista["Local_path"] +'\')">';
        llista+= '<div style="width:25%"><img src="' + obsLlista["Local_path"] + '" style="width:10vh; height:10vh" /></div>';
        llista+= '<label style="width:25%">' + formatDate(obsLlista["Data_observacio"]) + '<br>' + obsLlista["Hora_observacio"] +'</label>';
        if(obsLlista["Id_feno"]!="0") {
          llista+= '<label style="width:25%">' + fenomens[obsLlista["Id_feno"]]["Titol_feno"] + '</label>';
        } else {
          llista+= '<label style="width:25%">' + "Sense identificar" + '</label>';
        }
        llista+= '<div style="width:25%">';
        if(obsLlista["Enviat"] == "1") {
          llista+= '<img src="img/check-verd.png" style="width:8vh; height:8vh" />';
        } else {
          llista+= '<img src="img/check-gris.png" style="width:8vh; height:8vh" />';
        }
        llista+= '</div></div>';        
      }
      document.getElementById('llistat').innerHTML = llista;
    }, empty) 
  });
}

function desaObservacio(entry){  
  // DESA OBSERVACIÓ
  var ara = new Date(Date.now());
  var any = ara.getFullYear();
  var mes = ara.getMonth();
  var dia = ara.getDate();
  var hora = ara.getHours();
  var minut = ara.getMinutes();
  var segon = ara.getSeconds();
  var Data_observacio = any + '-' + mes + '-' + dia;
  var Hora_observacio = hora + ':' + minut + ':' + segon;

  numObs++;
  observacioActual = entry.toURL();
  console.log("numObs: " + numObs);
  console.log("observacioActual: " + observacioActual);

  var query = 'INSERT INTO Observacions (ID, Data_observacio, Hora_observacio, Latitud, Longitud, Id_feno, Descripcio_observacio, Fotografia_observacio, Local_path, Enviat) VALUES ("';
  query += '0' + '","';
  query += Data_observacio + '","';
  query += Hora_observacio + '","';
  query += latitudActual + '","';
  query += longitudActual + '","';
  query += '0' + '","';
  query += '0' + '","';
  query += '0' + '","';
  query += observacioActual + '","';
  query += '0' + '")';
  console.log(query);
  db.transaction(function (tx) {
    tx.executeSql(query);
  });
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

function getFileContentAsBase64(path,callback){
  window.resolveLocalFileSystemURL(path, gotFile, fail);          
  function fail(e) {
        alert('Cannot found requested file');
  }
  function gotFile(fileEntry) {
         fileEntry.file(function(file) {
            var reader = new FileReader();
            reader.onloadend = function(e) {
                 var content = this.result;
                 callback(content);
            };
            // The most important point, use the readAsDatURL Method from the file plugin
            reader.readAsDataURL(file);
         });
  }
}

function formatDate(dia) {
  if(dia.indexOf(":") == -1) {
    var parts = dia.split('-');
  } else {
    var parts = dia.split(':');
  }
  var d = new Date(parts[0], parts[1] - 1, parts[2]); 
  month = '' + (d.getMonth() + 1);
  day = '' + d.getDate();
  year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [day, month, year].join('-');
}

