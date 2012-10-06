var App = Ember.Application.create();

App.Meigen = Ember.Object.extend({
  titleLower: function() {
    return this.get('title').toLowerCase();
  }.property('title'),
  characterLower: function() {
    return this.get('character').toLowerCase();
  }.property('character'),
  bodyLower: function() {
    return (this.get('body') || '').toLowerCase();
  }.property('body'),
  markdown: function() {
    return '[![' +this.escapeAlt(this.get('alt')) + '](' + this.get('image') + ')](' + this.get('entryUrl') + ')';
  }.property('image'),
  alt: function() {
    var body = this.get('body');
    if (body) {
      return body;
    } else {
      return this.get('id') + ' ' + this.get('title');
    }
  }.property('id', 'title'),
  entryUrl: function() {
    return "http://jigokuno.com/?eid=" + this.get('eid');
  }.property('eid'),
  escapeAlt: function(str) {
    return str.replace(/\]/g, '\\]').
      replace(/(?:\r|\n|　)+/g, ' ').
      replace(/\s+$/, '');
  }
});

App.Meigen.reopenClass({
  data: Ember.A(window.meigens.map(function(entry) {
    return App.Meigen.create(entry);
  })),
  search: function(query, limit, cidFacet) {
    var self = this;
    var queryLower = (query || '').toLowerCase();
    var filtered = this.data.filter(function(item, index) {
      return (!cidFacet || item.get('cid') === cidFacet) &&
        (!query || (
          self.isSubstring(item.get('titleLower'), queryLower) ||
          self.isSubstring(item.get('characterLower'), queryLower) ||
          self.isSubstring(item.get('bodyLower'), queryLower) ||
          item.id == query
        )
      );
    });
    var sorted = filtered.sort(function(a, b) {
      return b.eid - a.eid;
    });
    var limited = limit ? sorted.slice(0, limit) : sorted;

    return {hits: filtered.length, records: limited};
  },
  isSubstring: function(str, query) {
    return str.indexOf(query) >= 0;
  },
  find: function(id) {
    return this.data.findProperty('id', id);
  },
  sample: function(n) {
    var i;
    var sampled = Ember.A([]);
    var records = this.data;

    for (i = 0; i < n; i++) {
      if (records.length === 0) {
        return sampled;
      }
      var selected = records[Math.floor(Math.random() * records.length)];
      sampled.push(selected);
      records = records.without(selected);
    }

    return sampled;
  }
});

App.searchController = Ember.ArrayController.create({
  query: null,
  limit: 3*40,
  cidFacet: null,
  character: null,

  data: function() {
    var query = this.get('query');
    var cidFacet = this.get('cidFacet');
    var limit = this.get('limit');
    if ((!query || query === '') && !cidFacet) {
      return [];
    }
    return App.Meigen.search(query, limit, cidFacet);
  }.property('query', 'limit', 'cidFacet'),
  hits: function() {
    return this.get('data').hits;
  }.property('data'),
  content: function() {
    return this.get('data').records;
  }.property('data'),
  notFound: function() {
    var query = this.get('query') || '';
    return query !== '' && !this.get('hits');
  }.property('query', 'hits'),
  hideClip: function() {
    if (!this.get('hits')) {
      App.clip.hide();
    }
  }.observes('hits'),
  isSnipped: function() {
    var hits = this.get('hits');
    return hits && hits > this.get('limit');
  }.property('hits', 'limit'),
  isSearchWorking: function() {
    var query = this.get('query') || '';
    return !!((query !== '') || this.get('cidFacet'));
  }.property('query', 'cidFacet')
});

App.SearchFormView = Ember.View.extend({
  tagName: 'form',
  controller: App.searchController,
  classNames: ['navbar-search', 'pull-left'],
  didInsertElement: function() {
    Ember.$('form input[type="text"]').focus();
  },
  submit: function(event) {
    event.preventDefault();
  },
  resetQuery: function() {
    this.get('controller').set('query', null);
  },
  resetCidFacet: function() {
    this.get('controller').set('cidFacet', null);
    this.get('controller').set('character', null);
  }
});

App.topController = Ember.ArrayController.extend({
  numberOfMeigens: 3,
  content: [],
  init: function() {
    this.refresh();
  },
  refresh: function() {
    this.set('content', App.Meigen.sample(this.numberOfMeigens));
  }
}).create();

App.TopView = Ember.View.extend({
  controller: App.topController,
  templateName: 'top',

  refresh: function() {
    this.get('controller').refresh();
    _gaq.push(['_trackEvent', 'Top', 'Refresh']);
  }
});

App.SearchResultsView = Ember.View.extend({
  controller: App.searchController,
  templateName: 'search-result'
});

App.ClippableButtonView = Ember.View.extend({
  tagName: 'button',
  copyText: null,
  eventSummary: null,
  classNames: ['btn btn-mini'],

  eventManager: Ember.Object.create({
    mouseEnter: function(event, view) {
      var target = event.target;
      var text = view.get('copyText');
      App.clip.setText(text);
      // Pass additional information via ZeroClipboard.Client()
      App.clip.eventSummary = view.get('eventSummary');
      if (App.clipGlued) {
        App.clip.reposition(target);
      } else {
        App.clip.glue(target);
        App.clipGlued = true;
      }
    }
  })
});

App.MeigensView = Ember.View.extend({
  tagName: 'ul',
  classNames: 'thumbnails'.w(),
  template: Ember.Handlebars.compile('{{#each controller}}' +
    '{{view view.MeigenView contentBinding="this"}}' +
    '{{/each}}'),

  MeigenView: Ember.View.extend({
    templateName: 'meigen',
    tagName: 'li',
    classNames: 'span4',
    content: null,

    eventSummary: function() {
      var content = this.get('content');
      return '' + content.get('id') + ' ' + content.get('title');
    }.property('id', 'title'),
    selectCharacter: function() {
      var character = this.get('content').get('character');
      var cid = this.get('content').get('cid');
      App.searchController.set('cidFacet', cid);
      App.searchController.set('character', character);
      _gaq.push(['_trackEvent', 'Character', 'Facet', '' + cid + ' ' + character]);
    }
  })
});

App.notificationController = Ember.ObjectController.create({
  content: null,

  flash: function(message) {
    this.set('content', message);
  }
});

App.NotificationView = Ember.View.extend({
  tagName: 'p',
  controller: App.notificationController,
  classNames: ['navbar-text', 'pull-right'],

  template: Ember.Handlebars.compile(
    '{{#if content}}' +
    '{{view view.LabelView contentBinding="this"}}' +
    '{{/if}}'),

  LabelView: Ember.View.extend({
    tagName: 'span',
    classNames: ['label', 'label-important'],
    content: null,
    template: Ember.Handlebars.compile("{{content}}"),

    didInsertElement: function(){
      var self = this;
      setTimeout(function() {
        self.$().fadeOut('fast', function() {
          self.get('parentView').controller.set('content', null);
        });
      }, 500);
    },
  })
});

App.clip = new ZeroClipboard.Client();
App.clip.addEventListener('complete', function(client, text) {
  App.notificationController.flash('Copied!');
  _gaq.push(['_trackEvent', 'Meigen', 'Copy', client.eventSummary]);
});
App.clipGlued = false;

App.ApplicationController = Ember.Controller.extend({
});

App.ApplicationView = Ember.View.extend({
  templateName: 'application'
});

App.HomeView = Ember.View.extend({
  templateName: 'home'
});

App.Router = Ember.Router.extend({
  root: Ember.Route.extend({
    home: Ember.Route.extend({
      route: '/',
      connectOutlets: function(router) {
        router.get('applicationController').connectOutlet('home');
      }
    })
  })
});
