var datasetURL = 'https://data.humdata.org/api/action/package_show?id=energy-consumption-of-refugees-and-displaced-people';
var urbanURL = encodeURIComponent('https://demo-data.humdata.org/dataset/dc9da294-26af-4f22-9f0c-8acfb0cdf17e/resource/599be5e3-35ad-4352-8fa8-377b085ab861/download/urban_consumption.csv');
var slumURL = encodeURIComponent('https://demo-data.humdata.org/dataset/dc9da294-26af-4f22-9f0c-8acfb0cdf17e/resource/a3d57e6c-627a-4279-b5d7-06d6d1e16f8c/download/slum_consumption.csv');
var ruralURL = encodeURIComponent('https://demo-data.humdata.org/dataset/dc9da294-26af-4f22-9f0c-8acfb0cdf17e/resource/061b343d-6fd8-4505-97f2-9ebd46728968/download/rural_consumption.csv');
var nonCampURL = 'https://data.humdata.org/hxlproxy/data.json?filter01=add&add-tag01=%23indicator%2Blocation&add-value01=urban&filter02=append&append-dataset02-01='+slumURL+'&filter03=replace&replace-pattern03=%5E%24&replace-regex03=on&replace-value03=slum&replace-tags03=%23indicator%2Blocation&filter04=append&append-dataset04-01='+ruralURL+'&filter05=replace&replace-pattern05=%5E%24&replace-regex05=on&replace-value05=rural&replace-tags05=%23indicator%2Blocation&filter06=select&select-query06-01=%23indicator%2Btier%3DBaseline&strip-headers=on&url='+urbanURL;

var campURL = encodeURIComponent('https://demo-data.humdata.org/dataset/dc9da294-26af-4f22-9f0c-8acfb0cdf17e/resource/54992e56-7918-4c05-84b2-2a7bef4f95cd/download/camp_consumption.csv');
var largeCampsURL = 'https://data.humdata.org/hxlproxy/data.json?filter01=select&select-query01-01=%23indicator%2Btier%3DBaseline&strip-headers=on&url='+campURL;
var smallCampsURL = '';

var popURL = encodeURIComponent('https://demo-data.humdata.org/dataset/dc9da294-26af-4f22-9f0c-8acfb0cdf17e/resource/f085427c-9fc7-4651-a0dd-228ce9147f58/download/population.csv');
popURL = 'https://data.humdata.org/hxlproxy/data.json?strip-headers=on&url='+popURL;

function hxlProxyToJSON(input){
    var output = [];
    var keys=[]
    input.forEach(function(e,i){
        if(i==0){
            e.forEach(function(e2,i2){
                var parts = e2.split('+');
                var key = parts[0]
                if(parts.length>1){
                    var atts = parts.splice(1,parts.length);
                    atts.sort();                    
                    atts.forEach(function(att){
                        key +='+'+att
                    });
                }
                keys.push(key);
            });
        } else {
            var row = {};
            e.forEach(function(e2,i2){
                row[keys[i2]] = e2;
            });
            output.push(row);
        }
    });
    return output;
}

function generateMap(geom,cookingPerCountry) {
    //remove loader
    $('.sp-circle').remove();

    var baselayer = L.tileLayer('https://data.humdata.org/mapbox-base-tiles/{z}/{x}/{y}.png', {});
    var labels = L.tileLayer('https://data.humdata.org/mapbox-layer-tiles/{z}/{x}/{y}.png', {minZoom: 2, pane: 'labels'});

    map = L.map('map',{
        center: [0,0],
        zoom: 2,
        layers: [baselayer]
    });

    map.createPane('labels');

    var cls;
    var style = function(feature) {
        var clr = '#aaaaaa';
        var borderClr = '#f2f2ef';
        var fillClr = '#08306b';
        var fillOpacity = 0;
        cls = 'country';

        var iso3 = feature.properties['ISO_3'];
        if (iso3!=null) {
            var type = cookingPerCountry[iso3];
            if (type!=undefined) {
                clr = cookingColors[type];
                fillOpacity = 0.7;
                cls = '';
            }
            else {
                cls = 'no-data';
            }
        }

        return {
            color: borderClr,
            fillColor: clr,
            weight: 1,
            opacity: 1,
            fillOpacity: fillOpacity,
            className: cls
        };
    }

    map.overlay = L.geoJson(geom, {
        style: style,
        onEachFeature: function (feature, layer) {
            feature.properties.bounds_calculated = layer.getBounds();
            if (cls != 'no-data') {
                layer.on({
                    click: mapClick
                });
            }
        }
    }).addTo(map);

    map.getPane('labels').style.zIndex = 650;
    map.getPane('labels').style.pointerEvents = 'none';

    labels.addTo(map);
}

function generateMapLegend() {
    var legend = $('#mapLegend');
    legend.append('<h5>Cooking Fuel Source</h5><ul></ul>');
    for (var key in cookingColors) {
        legend.find('ul').append('<li><div class="color" style="background-color:' + cookingColors[key] + '"></div> ' + key + '</li>');
    }
}

function mapClick(e) {
    var iso3 = e.target.feature.properties['ISO_3'];
    countryOverview(iso3);
    $('#countryModal').modal('show');

    myCookingChart.flush();
    myLightingChart.flush();

    for (var i=0; i<charts.length; i++) {
        if(charts[i]!=undefined){
            charts[i].flush();
        }
    }

    cookingLabels = {};
    lightingLabels = {};
    charts = [];
}

function buildModalOverview(iso3, cooking, lighting) {
    var expTotalCooking = 0;
    var expTotalLighting = 0;
    var popTotal = refugeePopData[iso3];
    var modal = $('#countryModal');

    //pre-populate feedback form link
    setFormLink(countryNames[iso3]);

    $('#definitions').hide();
    $('#maincontent').show();
    $('.definitions-link').html('Camp Definitions');

    //country title
    modal.find('.modal-title').text(countryNames[iso3]);

    //population
    modal.find('.overview-population span').text(popFormat(popTotal));
    
    //cooking
    var cookingData = [];
    for (var prop in cooking) {
        expTotalCooking = (cooking[prop]==undefined) ? expTotalCooking : expTotalCooking + cooking[prop];
        cookingData.push([prop, numFormatSF(cooking[prop])]);
    }

    //lighting
    var lightingData = [];
    for (var prop in lighting) {
        expTotalLighting = (lighting[prop]==undefined) ? expTotalLighting : expTotalLighting + lighting[prop];
        lightingData.push([prop, numFormatSF(lighting[prop])]);
    }

    //totals
    modal.find('.overview-cooking .exp-total span').text( '$'+numFormat(expTotalCooking)+'M' );
    modal.find('.overview-cooking .exp-percapita span').text( getExpPerCapita(expTotalCooking, popTotal) );
    modal.find('.overview-lighting .exp-total span').text( '$'+numFormat(expTotalLighting)+'M' );
    modal.find('.overview-lighting .exp-percapita span').text( getExpPerCapita(expTotalLighting, popTotal) );

    //pie charts
    myCookingChart = buildPieChart('cooking', cookingData, 200);
    myLightingChart = buildPieChart('lighting', lightingData, 200);
}

function buildModalInfo(camp, type) {
    var expTotalCooking = 0;
    var expTotalLighting = 0;
    var campCls = 'camp'+camp.id;
    var myCookingChartID = 'cooking'+camp.id+'Chart';
    var myLightingChartID = 'lighting'+camp.id+'Chart';
    var modal = $('#countryModal');
    if (type===undefined || type!=='') type='camp';

    //cooking
    var cookingData = [];
    for (var key in camp.cooking) {
        expTotalCooking = (camp.cooking[key]==undefined) ? expTotalCooking : expTotalCooking + camp.cooking[key];
        cookingData.push([key, numFormatSF(camp.cooking[key])]);
    }

    //lighting
    var lightingData = [];
    for (var key in camp.lighting) {
        expTotalLighting = (camp.lighting[key]==undefined) ? expTotalLighting : expTotalLighting + camp.lighting[key];
        lightingData.push([key, numFormatSF(camp.lighting[key])]);
    }

    modal.find('.info .location').append('<div class="row camp '+campCls+'"><div class="col-sm-2 col-xs-12 info-labels">'+camp.name+'</div><div class="col-xs-2" id="'+ myCookingChartID +'"></div><div class="col-sm-3 col-xs-4 cooking"></div><div class="col-xs-2" id="'+myLightingChartID+'"></div><div class="col-sm-3 col-xs-4 lighting"></div></div>');

    //totals
    modal.find('.'+campCls+' .cooking').html( 'Exp/yr: $'+numFormat2(expTotalCooking)+'M<br>Per Cap: '+ getExpPerCapita(expTotalCooking, camp.pop) +'<br>Pop: '+ popFormat(camp.pop) );
    modal.find('.'+campCls+' .lighting').html( 'Exp/yr: $'+numFormat2(expTotalLighting)+'M<br>Per Cap: '+ getExpPerCapita(expTotalLighting, camp.pop) +'<br>Pop: '+ popFormat(camp.pop) );

    //pie/donut charts
    var cookChart, lightChart;
    if (type=='camp') {
        cookChart = buildSquareChart('cooking'+camp.id, cookingData, 70, false);
        lightChart = buildSquareChart('lighting'+camp.id, lightingData, 70, false);
    }
    else { //non-camp
        cookChart = buildPieChart('cooking'+camp.id, cookingData, 70, false);
        lightChart = buildPieChart('lighting'+camp.id, lightingData, 70, false);
        modal.find(campCls).css('border','1px solid #000');
    }

    //save reference to charts
    charts.push(cookChart);
    charts.push(lightChart);
}

function buildPieChart(title, data, height, showLegend) {
    if (showLegend===undefined || showLegend!=='') showLegend=true;
    var clrs = (title.indexOf('cooking')>-1) ? 'cooking' : 'lighting';
    var chart = c3.generate({
        bindto: '#'+title+'Chart',
        data: {
            columns: data,
            type : 'pie',
            color: function (color, d) {
                var colors = pieColors[clrs];
                if(typeof d === 'object') {
                    return colors[d.id];
                }else {
                    return colors[d];
                }
            }
        },
        onrendered: function() {
            d3.selectAll('.camp .c3-chart-arcs').each(function() {
                if ($(window).width() >= 768)
                    d3.select(this).attr('transform', 'translate(57,33)');
            });
        },
        size: { height: height },
        //color: { pattern: pieColors[clrs] },
        pie: {
            label: {
                format: function (value, ratio, id) {
                    return d3.format('$')(value)+'M';
                },
                threshold: 0.05
            }
        },
        legend: {
            position: 'right',
            show: showLegend
        }
    });
    return chart;
}

function buildSquareChart(title, data, height){
    if (data[0]!=undefined) {
        var clrs = (title.indexOf('cooking')>-1) ? 'cooking' : 'lighting';
        var svgContainer = d3.select('#'+title+'Chart').append("svg")
            .attr("width", height)
            .attr("height", height);
        var d = data[0][0];
        var rectangle = svgContainer.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", height)
            .attr("height", height)
            .attr("fill", function () {
                    var colors = pieColors[clrs];
                    if(typeof d === 'object') {
                        return colors[d.id];
                    }else {
                        return colors[d];
                    }
                });
    }
}

function buildDonutChart(title, data, height, showLegend) {
    if (showLegend===undefined || showLegend!=='') showLegend=true;
    var clrs = (title.indexOf('cooking')>-1) ? 'cooking' : 'lighting';
    var chart = c3.generate({
        bindto: '#'+title+'Chart',
        data: {
            columns: data,
            type : 'donut',
            color: function (color, d) {
                var colors = pieColors[clrs];
                if(typeof d === 'object') {
                    return colors[d.id];
                }else {
                    return colors[d];
                }
            }
        },
        size: { height: height },
        //color: { pattern: pieColors[clrs] },
        donut: {
            label: {
                format: function (value, ratio, id) {
                    return d3.format('$')(value)+'M';
                },
                threshold: 0.05
            }
        },
        legend: {
            position: 'right',
            show: showLegend
        }
    });
    return chart;
}

function buildLegend() {
    var legend = $('#countryModal').find('#legend');
    for (var pie in pieColors) {
        var leg = legend.find('.'+pie+'Legend ul');
        for (var color in pieColors[pie]) {
            leg.append('<li><div class="square" style="background-color:' + pieColors[pie][color] + '"></div> ' + color + '</li>');
        }
    }
}

function setFormLink(country) {
    $('.form-link').attr('href', 'https://docs.google.com/forms/d/e/1FAIpQLSdRLnbL31zoyNunwPhfrSXzkf7FCTFHRS0jHK8n736W7o58Hw/viewform?usp=pp_url&entry.1658201850=' + country + '&entry.1869536362');
}

function getExpPerCapita(total, pop) {
    if (pop<=0)
        return '$'+numFormat(0);
    else
        return '$'+numFormat((total*1000000)/pop);
}

function getRefugeesPerCountry(dataset){
    var output = {};
    dataset.forEach(function(row){
        var country = row['#country+code'];
        if(output[country]===undefined){
            output[country] = Math.round(Number(row['#population+num']));
        } else {
            output[country] += Math.round(Number(row['#population+num']));
        }
    });      
    return output;
}

function getCookingPerCountry(countries, nonCampData, largeCampData){
    var output = {};
    for (var country in countries) {
        var cooking = {};
        nonCampData.forEach(function(row){
            if(row['#country+code']===country){
                key = 'LPG/Natural Gas';
                value = Number(row['#indicator+expenditure+nonsolid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }

                key = row['#indicator+cooking+text'];
                value = Number(row['#indicator+expenditure+solid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }                
            }
        });

        largeCampData.forEach(function(row){
            if(row['#country+code']===country){
                key = row['#indicator+cooking+text'];
                value = Number(row['#indicator+expenditure+solid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }                
            }
        });

        //get highest value from cooking
        if (Object.keys(cooking).length>0) {
            output[country] = Object.keys(cooking).reduce(function(a, b){ return cooking[a] > cooking[b] ? a : b });
        }
    }
    return output;
}

function getCountryNames(datasets) {
    var output = [];
    datasets.forEach(function(dataset){
        dataset.forEach(function(row){
            output[row['#country+code']] = row['#country+name'];
        });
    });
    return output;
}

function getParamValue(paramName) {
    var url = window.location.search.substring(1); 
    var qArray = url.split('&'); 
    for (var i=0; i<qArray.length; i++) {
        var pArr = qArray[i].split('='); 
        if (pArr[0] == paramName) 
            return pArr[1]; 
    }
}

function formatDate(date) {
    var monthArray = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var d = date.split('/');
    var m = d[0];
    if (d[0].length>1) { //check for leading 0
        var m = d[0].split('');
        m = (m[0]=='0') ? m[1] : d[0];
    }
    d = d[1] + ' ' + monthArray[m-1] + ' ' + d[2];
    return d;
}


var numFormat = function(d){return d3.format('.2f')(d)};
var numFormat2 = function(d){return d3.format('.3f')(d)};
var numFormatSF = function(d){return d3.format('.2g')(d)};
var popFormat = d3.format('.2s');


var datasetCall = $.ajax({ 
    type: 'GET', 
    url: datasetURL,
    dataType: 'json',
});

var nonCampCall = $.ajax({ 
    type: 'GET', 
    url: nonCampURL,
    dataType: 'json',
});

var largeCampCall = $.ajax({ 
    type: 'GET', 
    url: largeCampsURL,
    dataType: 'json',
});

var popCall = $.ajax({ 
    type: 'GET', 
    url: popURL,
    dataType: 'json',
});

var geomCall = $.ajax({ 
    type: 'GET', 
    url: 'data/geom.json',
    dataType: 'json',
});

var datasetDate;
var countryOverview, refugeePopData, countryNames, cookingPerCountry;
var myCookingChart, myLightingChart;
var charts = [];
var lightingColors = {'On grid':'#8bb2cd','Torch dependent':'#bdd2c8','Liquid-Fuel dependent':'#f2d9a3','Solar dependent':'#f4c5a0'};
var cookingColors = {'LPG/Natural Gas':'#00719a','Firewood dependent':'#7da895','Firewood/charcoal mix':'#bea487','Alternative biomass':'#e1b53d','Liquid-Fuel dependent':'#e68944'};
var pieColors = {'cooking':cookingColors,'lighting':lightingColors};

$.when(datasetCall, nonCampCall,largeCampCall,geomCall,popCall).then(function(datasetArgs, nonCampArgs,largeCampArgs,geomArgs,popArgs){
    var nonCampData = hxlProxyToJSON(nonCampArgs[0]);
    var largeCampData = hxlProxyToJSON(largeCampArgs[0]);
    var geomData = topojson.feature(geomArgs[0],geomArgs[0].objects.geom);
    var popData = hxlProxyToJSON(popArgs[0]);
    refugeePopData = getRefugeesPerCountry(popData);
    countryNames = getCountryNames([nonCampData, largeCampData]);
    cookingPerCountry = getCookingPerCountry(countryNames, nonCampData, largeCampData);
    datasetDate = formatDate(datasetArgs[0].result.dataset_date);

    //check value of viz description in url parameter -- hide by default
    var showDescription = getParamValue('showDescription');
    if (showDescription=='true') $('.viz-description').show();

    countryOverview = function(iso3) {
        var lighting = {};
        var cooking = {};
        var camps = [];

        //set date
        $('.modal-footer .date').html('Data last modified '+datasetDate);

        nonCampData.forEach(function(row){
            if(row['#country+code']===iso3){
                var key = 'On grid';
                var value = Number(row['#indicator+expenditure+grid+value']);
                if(lighting[key] === undefined){
                    lighting[key] = value;
                } else {
                    lighting[key] += value;
                }

                key = row['#indicator+lighting+text'];
                value = Number(row['#indicator+expenditure+offgrid+value']);
                if(lighting[key] === undefined){
                    lighting[key] = value;
                } else {
                    lighting[key] += value;
                }
                
                key = 'LPG/Natural Gas';
                value = Number(row['#indicator+expenditure+nonsolid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }

                key = row['#indicator+cooking+text'];
                value = Number(row['#indicator+expenditure+solid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }                
            }
        });

        //sort camps by population
        largeCampData.sort(function(a, b) {
             return parseFloat(b['#population+num']) - parseFloat(a['#population+num']);
        });

        largeCampData.forEach(function(row){
            if(row['#country+code']===iso3){
                key = row['#indicator+lighting+text'];
                value = Number(row['#indicator+expenditure+offgrid+value']);
                row['#loc+name'] = row['#loc+name'].replace(' :', ':');
                camps.push(row['#loc+name']);
                if(lighting[key] === undefined){
                    lighting[key] = value;
                } else {
                    lighting[key] += value;
                }
                key = row['#indicator+cooking+text'];
                value = Number(row['#indicator+expenditure+solid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }                
            }
        });

        //build modal    
        buildModalOverview(iso3, cooking, lighting);

        //clear the info columns in modal
        $('#countryModal').find('.camp').remove();

        //get noncamp info
        subCountryOverview(iso3);

        //get camp info
        camps.forEach(function(camp, id) {
            //+100 so ids dont overlap with noncamp ids
            campOverview(camp, id+100);
        });
    }

    var campOverview = function(campname, id){
        var camp = {'name':campname, 'id': id};
        var lighting = {};
        var cooking = {};
        largeCampData.forEach(function(row){
            if(row['#loc+name']===campname){
                var key = row['#indicator+lighting+text'];
                var value = Number(row['#indicator+expenditure+offgrid+value']);
                camp.pop = Number(row['#population+num']);
                if(lighting[key] === undefined){
                    lighting[key] = value;
                } else {
                    lighting[key] += value;
                }

                key = row['#indicator+cooking+text'];
                value = Number(row['#indicator+expenditure+solid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }                
            }
        });     

        //build modal  
        camp.cooking = cooking;
        camp.lighting = lighting;
        buildModalInfo(camp);
    }

    var subCountryOverview = function(iso3){
        var noncamp = {'name':'Non-camp', 'id':0};
        var lighting = {};
        var cooking = {};
        noncamp.pop = 0;
        nonCampData.forEach(function(row){
            if(row['#country+code']===iso3){
                var key = 'On grid';
                var value = Number(row['#indicator+expenditure+grid+value']);
                noncamp.pop += Math.round(row['#population+num']);
                if(lighting[key] === undefined){
                    lighting[key] = value;
                } else {
                    lighting[key] += value;
                }

                key = row['#indicator+lighting+text'];
                value = Number(row['#indicator+expenditure+offgrid+value']);
                if(lighting[key] === undefined){
                    lighting[key] = value;
                } else {
                    lighting[key] += value;
                }
                
                key = 'LPG/Natural Gas';
                value = Number(row['#indicator+expenditure+nonsolid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }

                key = row['#indicator+cooking+text'];
                value = Number(row['#indicator+expenditure+solid+value']);
                if(cooking[key] === undefined){
                    cooking[key] = value;
                } else {
                    cooking[key] += value;
                }                
            }
        });

        //build modal  
        noncamp.cooking = cooking;
        noncamp.lighting = lighting;
        buildModalInfo(noncamp, 'noncamp');
    }

    generateMap(geomData,cookingPerCountry);
    generateMapLegend();
    buildLegend();

    $('.definitions-link').on('click',function(event){
        event.preventDefault();
        if($('#maincontent').is(':visible')){
            $('#definitions').show();
            $('#maincontent').hide();
            $('.definitions-link').html('Country Overview');
        } else {
            $('#definitions').hide();
            $('#maincontent').show();
            $('.definitions-link').html('Camp Definitions');
        }
    });
});
