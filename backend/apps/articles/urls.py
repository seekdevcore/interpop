from django.urls import path
from .views import ArticleDetailView, ArticleListView, ArticleViewCountView, CategoryListView

urlpatterns = [
    path('categories/',                CategoryListView.as_view(),     name='category-list'),
    path('articles/',                  ArticleListView.as_view(),      name='article-list'),
    path('articles/<uslug:slug>/',     ArticleDetailView.as_view(),    name='article-detail'),
    path('articles/<uslug:slug>/view/', ArticleViewCountView.as_view(), name='article-view'),
]
