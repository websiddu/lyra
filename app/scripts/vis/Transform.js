vde.Vis.Transform = (function() {
  var transform = function(pipelineName, type, displayName, input, output) {
    this.type = type;
    this.displayName = displayName;

    this.input = input;
    this.output = output;

    this.pipelineName = pipelineName;
    this.forkPipeline = false;  // Structural transforms cause a fork
    this.requiresFork = false;

    this.isVisual     = false;

    this.properties = {};

    return this;
  };

  var prototype = transform.prototype;

  prototype.destroy = function() { return; };

  prototype.pipeline = function() {
    return vde.Vis.pipelines[this.pipelineName];
  };

  prototype.spec = function() {
    var spec = {type: this.type};
    for(var i = 0; i < this.input.length; i++) {
      var prop   = this.input[i], value  = this.properties[prop];
      if(!value) continue;
      spec[prop] = value instanceof vde.Vis.Field ? value.spec() : value;
    }

    return spec;
  };

  prototype.bindProperty = function(prop, opts) {
    var field = opts.field;
    if(!field) return; // Because this makes negatory sense.
    if(!(field instanceof vde.Vis.Field)) field = new vde.Vis.Field(field);

    this.properties[prop] = field;
  };

  prototype.unbindProperty = function(prop) {
    delete this.properties[prop];
  };

  // Assumes data is already ingested
  prototype.transform = function(data) {
    var spec = this.spec();
    if(!spec) return data;

    var transform = vg.parse.dataflow({transform: [spec]});
    return transform(data);
  };

  // Can this transform work on facets (i.e. can it just be
  // part of the regular pipeline transform, or must we move it
  // within the group injection)
  prototype.onFork = function() { return true; };

  return transform;
})();

vde.Vis.transforms = {};
